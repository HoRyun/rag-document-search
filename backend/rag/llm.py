from langchain_core.prompts import PromptTemplate
from langchain_community.llms import Ollama
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from config.settings import OLLAMA_HOST, OLLAMA_PORT


def format_docs(docs): # docs는 retriever의 반환값.
    # 검색한 문서 결과를 하나의 문단으로 합쳐줍니다.
    return "\n\n".join(doc.page_content for doc in docs)

def get_llms_answer(query: str, retriever: any) -> str:
    """LLM 모델 함수."""

    


    # 프롬프트를 생성합니다.
    # https://smith.langchain.com/hub/rlm/rag-prompt?organizationId=aa6b8f91-d07f-4c94-bd6f-b7e1aaeea6cf
    prompt = PromptTemplate.from_template(
        """
        You are an assistant for question-answering tasks. 
        Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know. 
        Use three sentences maximum and keep the answer concise. 
        
        The user will ask you questions about a file they are searching for. You must determine whether the user's requested document matches the information provided in the <context>. If a match is found, provide the metadata contained within the <context> to the user.

        The metadata includes the 'document name' and 'document path'.

        Your response must follow this format:
        Answer the user's question. -> If the document the user is looking for exists within the context, provide the metadata.        
        
        Answer in Korean.
    <Question> {question} </Question>
    <Context> {context} </Context>
    Answer:
    """
    )    

    # OpenAI 모델 사용, .env 파일에 openapi 키 설정 필요
    # 모델(LLM) 객체를 생성합니다.
    llm = ChatOpenAI(
    temperature=0.2,
    max_tokens=2048,
    model_name="gpt-4o-mini",)

    # Local Ollama 모델 사용 (Ollama 컨테이너 실행 필요)
    # llm = Ollama(base_url=f"http://{OLLAMA_HOST}:{OLLAMA_PORT}", model="llama2")

   
    # 단계 8: 체인(Chain) 생성
    chain = (
        {"question": RunnablePassthrough(), "context": retriever}
        | prompt
        | llm
        | StrOutputParser()
    )


    # 체인 실행(Run Chain)
    # 문서에 대한 질의를 입력하고, 답변을 출력합니다.
    question = query
    response = chain.invoke(question)
   
    return response

