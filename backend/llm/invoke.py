from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser


from sqlalchemy import text

import traceback

from fast_api.endpoints import op_schemas
from debug import debugging

def get_operation_type(command: str) -> dict:
    """
    명령어를 받아서 해당 명령어의 타입을 반환한다.
    키워드 매칭을 통해 작업 타입을 결정합니다.
    
    Returns:
        dict: {'value': str, 'value_type': str(optional)}
        value: delete, rename, create_folder, move, copy, summarize, search, error 중 하나
        value_type: error인 경우에만 할당 ('err-1' 또는 'err-2')
            - err-1: 부정표현 또는 파일관련이지만 매칭안됨
            - err-2: 파일과 관련없는 명령
    """
    # 부정 표현 확인 (한국어는 대소문자 구분 없음)
    negative_words = ["하지마", "말아", "안해", "못해", "금지"]
    has_negative = any(neg in command for neg in negative_words)
    
    # 부정 표현이 있는 경우 err-1 반환
    if has_negative:
        print(f"부정 표현 감지: 'error' (err-1) 반환")
        return {"value": "error", "value_type": "err-1"}
    
    # 특수 처리: "정리" 키워드의 중의성 해결
    if "정리" in command:
        if "내용" in command or "요약" in command:
            print(f"매칭된 키워드: '내용+정리' → 작업타입: 'summarize'")
            return {"value": "summarize", "value_type": None}
        else:
            print(f"매칭된 키워드: '정리' → 작업타입: 'delete'")
            return {"value": "delete", "value_type": None}
    
    # 각 작업 타입별 키워드 정의 (우선순위 순으로 정렬)
    operation_keywords = {
        "delete": ["삭제", "지우", "지워", "delete", "제거", "remove", "없애", "버려", "삭제해", "지워줘", "제거해", "없애줘", "버리", "폐기", "del", "삭제하", "지우기", "제거하"],
        "create_folder": ["폴더생성", "폴더만들", "폴더추가", "create", "새폴더", "디렉토리생성", "폴더만드", "만들어", "생성해", "만들고", "폴더", "디렉토리", "mkdir", "폴더를", "디렉토리를", "새로운", "추가", "생성", "만들", "새로", "create_folder"],
        "rename": ["이름변경", "이름바꾸", "이름수정", "rename", "제목변경", "제목바꾸", "수정하고", "바꿔", "변경", "수정", "바꿔줘", "변경해", "수정해", "리네임", "바꾸", "개명", "이름을", "제목을", "명칭", "바꿔주", "변경하"],
        "move": ["이동", "옮기", "옮겨", "move", "이사", "위치변경", "옮겨달", "이동해", "이동해줘", "옮겨줘", "이사시", "위치", "이동시", "mv", "이동하", "옮기기", "이동시키", "옮겨서", "이동을"],
        "copy": ["복사", "copy", "복제", "백업", "복사해", "복사해줘", "복제해", "복제해줘", "백업해", "cp", "카피", "복사시", "복제시", "복사하", "복제하", "백업하", "복사를", "복제를"],
        "summarize": ["요약", "summarize", "요약해", "summary", "요약해줘", "정리해", "요약정리", "간략", "요약하", "정리하", "요약을", "내용요약", "간단히", "정리"],
        "search": ["검색", "찾", "찾아", "search", "조회", "탐색", "찾아줘", "찾기", "검색해", "검색해줘", "찾아서", "조회해", "탐색해", "find", "look", "검색하", "찾으", "조회하", "찾을"]
    }
    
    # 키워드 매칭으로 작업 타입 결정
    for operation_type, keywords in operation_keywords.items():
        for keyword in keywords:
            # 한국어는 원본 그대로, 영어는 대소문자 무시하고 매칭
            if keyword in command or keyword.lower() in command.lower():
                
                # rename의 경우 파일명 관련 키워드 체크
                if operation_type == "rename":
                    filename_keywords = ["파일명", "이름", "제목", "명", "name", "title"]
                    has_filename_context = any(fn_keyword in command.lower() for fn_keyword in filename_keywords)
                    
                    if not has_filename_context:
                        # 파일명 관련 키워드가 없으면 에러로 처리
                        print(f"rename 키워드 매칭되었지만 파일명 관련 키워드 없음: 'error' (err-1) 반환")
                        return {"value": "error", "value_type": "err-1"}
                
                print(f"매칭된 키워드: '{keyword}' → 작업타입: '{operation_type}'")
                return {"value": operation_type, "value_type": None}
    
    # 파일 관련 키워드가 있는지 확인 (관련없는 명령 vs 매칭 안됨 구분)
    file_related_words = ["파일", "문서", "폴더", "디렉토리", "file", "folder", "document", "dir"]
    has_file_context = any(word in command.lower() for word in file_related_words)
    
    if has_file_context:
        # 파일 관련이지만 매칭 안됨 - err-1
        print(f"파일 관련이지만 매칭 안됨: 'error' (err-1) 반환")
        return {"value": "error", "value_type": "err-1"}
    else:
        # 파일과 관련없는 명령 - err-2
        print(f"관련없는 명령: 'error' (err-2) 반환")
        return {"value": "error", "value_type": "err-2"}




async def analyze_move_command(command: str, context: op_schemas.OperationContext) -> tuple:
    """
    이동 명령어를 분석하여 목적지, 설명, 경고 메시지를 반환한다.
    
    ai 출력의 양식을 정의:
    <출력 양식>
    <destination>{목적지 경로}</destination>
    <preview>{해당 작업에 대한 간단한 요약.}</preview>
    </출력 양식>


    프롬프트에 들어가야 하는 설명:
    - 사용자의 command를 분석해서 move작업이 수행되는 목적지 경로를 context.availableFolders에서 찾아야 한다.
    (context.availableFolders에 데이터가 실제로 어떻게 들어오는지 확인해야 한다. 확인 했을 경우 이 주석을 주석처리.)
    - 이 작업이 어떻게 수행될 것인지 간단히 요약해야 한다.

    함수의 리턴 값은 destination, preview.
    """
    # selectedFiles를 프롬프트에 들어갈 수 있도록 문자열로 변환.
    selectedFiles = convert_selected_files_to_string(context.selectedFiles)
    # availableFolders를 프롬프트에 들어갈 수 있도록 문자열로 변환.
    availableFolders = convert_available_folders_to_string(context.availableFolders)

    # 프롬프트 영어로 번역하여 다시 작성하기.
    prompt = PromptTemplate.from_template(
        """
<!-- 역할 -->
당신은 사용자의 파일 이동 요청을 해석하여
정해진 출력 형식(<destination>, <description>)을 생성합니다.

<!-- 입력 -->
<context>
  <command>{command}</command>
  <selectedFiles>{selectedFiles}</selectedFiles>
  <availableFolders>{availableFolders}</availableFolders>
</context>

<!-- 규칙 -->
1. <destination> 결정  
   1-1. command에 명시된 목적지가 availableFolders[*].name 과 일치하면  
        → 해당 항목의 path 값을 <destination>에 기록합니다.  
   1-2. 일치 항목이 없으면  
        → 사용자가 입력한 목적지 이름('폴더' 단어 제외)을 그대로 <destination>에 기록합니다.  
        → 이 경우 새 폴더를 생성해야 함을 <description>에 명시합니다.  

2. <description> 작성  
   기본 형식: "<selectedFiles>을 <destination>으로 이동합니다."  
   규칙 1-2 상황이면 문장 끝에  
   "<destination> 폴더를 새로 생성합니다." 를 추가합니다.  

<!-- 출력 -->
<destination>…</destination>,<description>…</description>

        """
    )

    llm = ChatOpenAI(
    temperature=0.1,
    max_tokens=1500,
    model_name="gpt-4o-mini",)

    
    # 체인 생성
    chain = (
        {"command": RunnablePassthrough(), "selectedFiles": RunnablePassthrough(), "availableFolders": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    # 체인 실행
    try:
        result = chain.invoke({"command": command, "selectedFiles": selectedFiles, "availableFolders": availableFolders})
        print(f"Operation type: {result}")
        
    except Exception as e:
        print(f"Error in get_operation_type: {e}")
        return "error"
    
    # 모델 출력 제어 성공했으므로 result를 파싱하여 값을 뽑아내고, 두 개의 변수를 리턴하는 로직 작성하기.
    destination = result.split("<destination>")[1].split("</destination>")[0]
    description = result.split("<description>")[1].split("</description>")[0]
    # debugging.stop_debugger()
    return (destination, description)

async def analyze_copy_command(command: str, context: op_schemas.OperationContext) -> tuple:
    """
    복사 명령어를 분석하여 목적지, 설명, 경고 메시지를 반환한다.
    
    ai 출력의 양식을 정의:
    <출력 양식>
    <destination>{목적지 경로}</destination>
    <description>{해당 작업에 대한 간단한 요약.}</description>
    </출력 양식>

    함수의 리턴 값은 destination, description.
    """
    # selectedFiles를 프롬프트에 들어갈 수 있도록 문자열로 변환.
    selectedFiles = convert_selected_files_to_string(context.selectedFiles)
    # availableFolders를 프롬프트에 들어갈 수 있도록 문자열로 변환.
    availableFolders = convert_available_folders_to_string(context.availableFolders)

    prompt = PromptTemplate.from_template(
        """
<!-- 역할 -->
당신은 사용자의 파일 복사 요청을 해석하여
정해진 출력 형식(<destination>, <description>)을 생성합니다.

<!-- 입력 -->
<context>
  <command>{command}</command>
  <selectedFiles>{selectedFiles}</selectedFiles>
  <availableFolders>{availableFolders}</availableFolders>
</context>

<!-- 규칙 -->
1. <destination> 결정  
   1-1. command에 명시된 목적지가 availableFolders[*].name 과 일치하면  
        → 해당 항목의 path 값을 <destination>에 기록합니다.  
   1-2. 일치 항목이 없으면  
        → 사용자가 입력한 목적지 이름('폴더' 단어 제외)을 그대로 <destination>에 기록합니다.  
        → 이 경우 새 폴더를 생성해야 함을 <description>에 명시합니다.  

2. <description> 작성  
   기본 형식: "<selectedFiles>을 <destination>으로 복사합니다."  
   규칙 1-2 상황이면 문장 끝에  
   "<destination> 폴더를 새로 생성합니다." 를 추가합니다.  

<!-- 출력 -->
<destination>…</destination>,<description>…</description>

        """
    )

    llm = ChatOpenAI(
    temperature=0.1,
    max_tokens=1500,
    model_name="gpt-4o-mini",)

    
    # 체인 생성
    chain = (
        {"command": RunnablePassthrough(), "selectedFiles": RunnablePassthrough(), "availableFolders": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    # 체인 실행
    try:
        result = chain.invoke({"command": command, "selectedFiles": selectedFiles, "availableFolders": availableFolders})
        print(f"Copy operation result: {result}")
        
    except Exception as e:
        print(f"Error in analyze_copy_command: {e}")
        return "error"
    
    # 모델 출력을 파싱하여 destination과 description을 추출
    destination = result.split("<destination>")[1].split("</destination>")[0]
    description = result.split("<description>")[1].split("</description>")[0]
    
    return (destination, description)


def convert_selected_files_to_string(selected_files: list) -> str:
    """
    선택된 파일 리스트를 특정 형식의 문자열로 변환합니다.
    
    Args:
        selected_files: 선택된 파일 정보가 담긴 리스트. 각 요소는 딕셔너리 형태.
        
    Returns:
        문자열로 변환된 선택 파일 정보
    """
    if not selected_files:
        return ""
    
    result = ""
    for file in selected_files:
        result += "<item>\n"
        result += f"id: {file.get('id', '')}\n"
        result += f"name: {file.get('name', '')}\n"
        result += f"type: {file.get('type', '')}\n"
        result += f"path: {file.get('path', '')}\n"
        result += "</item>\n"
    
    return result

def convert_available_folders_to_string(available_folders: list) -> str:
    """
    사용 가능한 폴더 리스트를 특정 형식의 문자열로 변환합니다.
    
    Args:
        available_folders: 사용 가능한 폴더 정보가 담긴 리스트. 각 요소는 딕셔너리 형태.
        
    Returns:
        문자열로 변환된 사용 가능한 폴더 정보
    """
    if not available_folders:
        return ""
    
    result = ""
    for folder in available_folders:
        result += "<item>\n"
        result += f"id: {folder.get('id', '')}\n"
        result += f"name: {folder.get('name', '')}\n"
        result += f"path: {folder.get('path', '')}\n"
        result += "</item>\n"
    
    return result

# 테스트 함수
def test_get_operation_type():
    test_commands = [
        "파일을 마케팅 폴더로 이동해줘",
        "문서를 복사해서 백업해줘", 
        "이 파일들 삭제해줘",
        "파일 이름변경해줘",
        "새 폴더 만들어줘",
        "문서 검색해줘",
        "이 파일들 요약해줘",
        "알 수 없는 명령어"
    ]
    
    print("=== get_operation_type 테스트 ===")
    for cmd in test_commands:
        result = get_operation_type(cmd)
        print(f"명령어: '{cmd}' → 결과: '{result}'")
        print()

# 테스트 실행 (주석 해제 시 테스트 실행)
# test_get_operation_type()