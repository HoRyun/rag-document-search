from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document

from sqlalchemy import text

import traceback


def format_docs(docs):
    """
    검색한 문서 결과를 하나의 문단으로 합쳐줍니다.
    문서가 없는 경우 예외 처리합니다.
    """
    if not docs:
        return "관련 문서를 찾을 수 없습니다."
    
    formatted_docs = []
    for doc in docs:
        content = f"<The name of this document:{doc.metadata['document_name']}> <The path of this document>{doc.metadata['document_path']}</The path of this document> {doc.page_content} </The name of this document:{doc.metadata['document_name']}>"
        formatted_docs.append(content)
    
    return "\n\n".join(formatted_docs)





def get_llms_answer(docs: list[Document], query: str) -> str:
    """LLM 모델 함수"""
    from db.database import engine  # 기존 엔진을 임포트
    # 프롬프트를 생성합니다.
    prompt = PromptTemplate.from_template(
        """
        You are an assistant for question-answering tasks. 
        Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know.
        Please provide the user with the file path information corresponding to the file they are requesting. Write the information after inserting one line break.
        Answer in Korean.

    <Question> {question} </Question>
    <Context> {context} </Context>
    Answer:
    """
    )

    # OpenAI 모델 객체를 생성한다.
    llm = ChatOpenAI(
    temperature=0.2,
    max_tokens=2048,
    model_name="gpt-4o-mini",)

    # 문서가 없으면 빈 컨텍스트 반환
    if not docs:
        print("검색된 문서가 없어 빈 컨텍스트로 처리합니다.")
        
    
    # 문서를 문자열로 변환
    try:
        formatted_docs = format_docs(docs)
    except Exception as e:
        print(f"문서 포맷팅 오류: {str(e)}")
        formatted_docs = "문서 처리 중 오류가 발생했습니다."




    # 단계 8: 체인(Chain) 생성
    chain = (
        {"question": RunnablePassthrough(), "context": lambda _: formatted_docs}
        | prompt
        | llm
        | StrOutputParser()
    )





    # 체인 실행(Run Chain)
    # 문서에 대한 질의를 입력하고, 답변을 출력합니다.
    try:
        response = chain.invoke(query)
    except Exception as e:
        print(f"LLM 응답 생성 오류: {str(e)}")
        print(f"오류 상세 내용: {traceback.format_exc()}")
        # 오류 발생 시 기본 응답 반환
        response = "죄송합니다. 답변을 생성하는 중에 오류가 발생했습니다."
   
    return response

