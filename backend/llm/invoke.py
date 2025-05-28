
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser


from sqlalchemy import text

import traceback



def get_operation_type(command: str) -> str:
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
    max_tokens=100,
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
        return result
    except Exception as e:
        print(f"Error in get_operation_type: {e}")
        return "error"
