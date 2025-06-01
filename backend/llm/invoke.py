from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser


from sqlalchemy import text

import traceback

from fast_api.endpoints import op_schemas
from debug import debugging

async def get_operation_type(command: str) -> str:
    """
    명령어를 받아서 해당 명령어의 타입을 반환한다.
    """
    prompt = PromptTemplate.from_template(
        """
        <Instructions>
You analyze the <User's command> and determine what operation the user wants to perform.
The operation the user requests is always one of the following:

* move
* copy
* delete
* rename
* create_folder
* search
* summarize

If <User's command> matches one of the above items, output it in the following format.
For example, if the user wants the operation "move," output as follows:
<operation.type>move</operation.type>

Summary of your task:

1. Identify the operation the user wants.
2. Respond according to the specified output format.

Note:
Write only the output.
        </Instructions>
        <User's command> {command} </User's command>
        
        Answer:
    """
    )

    # OpenAI 모델 객체를 생성한다.
    llm = ChatOpenAI(
    temperature=0.1,
    max_tokens=1000,
    model_name="gpt-4o-mini",)

    # 체인 생성
    chain = (
        {"command": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    # 체인 실행
    try:
        result = chain.invoke(command)
        print(f"Operation type: {result}")

        # 출력 형식에 맞게 결과 파싱
        result = result.strip()
        if result.startswith("<operation.type>"):
            result = result[len("<operation.type>"):].strip()
            if result.endswith("</operation.type>"):
                result = result[:-len("</operation.type>")].strip()
        
        return result
    except Exception as e:
        print(f"Error in get_operation_type: {e}")
        return "error"




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
        → 사용자가 입력한 목적지 이름(‘폴더’ 단어 제외)을 그대로 <destination>에 기록합니다.  
        → 이 경우 새 폴더를 생성해야 함을 <description>에 명시합니다.  

2. <description> 작성  
   기본 형식: “<selectedFiles>을 <destination>으로 이동합니다.”  
   규칙 1-2 상황이면 문장 끝에  
   “<destination> 폴더를 새로 생성합니다.” 를 추가합니다.  

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