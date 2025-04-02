from langchain_core.prompts import PromptTemplate
from langchain_community.llms import Ollama
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from config.settings import OLLAMA_HOST, OLLAMA_PORT


def get_llms_answer(query: str, retriever: any) -> str:
    """LLM 모델 함수."""

    # 프롬프트를 생성합니다.
    prompt = PromptTemplate.from_template(
        """You are an assistant for question-answering tasks. 
    Use the following pieces of retrieved context to answer the question. 
    If you don't know the answer, just say that you don't know. 
    Answer in Korean.

    #Context: 
    {context}

    #Question:
    {question}

    #Answer:"""
    )    

    # OpenAI 모델 사용, .env 파일에 openapi 키 설정 필요
    # 모델(LLM) 객체를 생성합니다.
    llm = ChatOpenAI(
    temperature=0.2,
    model_name="gpt-4o-mini",)


    # Local Ollama 모델 사용 (Ollama 컨테이너 실행 필요)
    # llm = Ollama(base_url=f"http://{OLLAMA_HOST}:{OLLAMA_PORT}", model="llama2")

    # OpenAI 모델 사용, .env 파일에 openapi 키 설정 필요
    # 모델(LLM) 객체를 생성합니다.
    # llm = ChatOpenAI(
    # temperature=0,
    # model_name="gpt-4o-mini",)


    # Local Ollama 모델 사용 (Ollama 컨테이너 실행 필요)
    llm = Ollama(base_url=f"http://{OLLAMA_HOST}:{OLLAMA_PORT}", model="llama2")

    # 단계 8: 체인(Chain) 생성
    chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )


    # 체인 실행(Run Chain)
    # 문서에 대한 질의를 입력하고, 답변을 출력합니다.
    question = query
    response = chain.invoke(question)
   
    return response

