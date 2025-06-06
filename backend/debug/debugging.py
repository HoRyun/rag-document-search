


# 디버깅 stop 시 다음 코드 강제 실행 불가하도록 하는 함수.
def stop_debugger():
    """q누르면 루프를 강제 종료한다."""
    while 1:
        # 키 입력 받기
        key = input("프로그램이 중단되었습니다. 끝내려면 'q', 계속하려면 'g'.")
        # q 키를 누르면 예외를 발생시켜 프로그램을 강제 종료
        if key.lower() == 'q':
            raise Exception("사용자에 의해 강제 종료되었습니다.")
        elif key.lower() == 'g':
            break


def redis_store_test(operation_id):
    from services.operation_store import get_operation_store
    operation_store = get_operation_store()

    print(f"TTL 확인:{operation_store.get_remaining_ttl(operation_id)}")
    print(f"--------------------------------")
    print(f"작업 정보 확인:{operation_store.get_operation(operation_id)}")
