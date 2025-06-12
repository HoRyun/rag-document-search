# AWS 콘솔을 사용한 API Gateway 생성 가이드

스크립트로 API Gateway를 생성하는 데 문제가 있는 경우, AWS 콘솔을 통해 수동으로 생성하는 방법을 안내합니다.

## 1. API Gateway 생성

1. AWS 콘솔에 로그인합니다.
2. API Gateway 서비스로 이동합니다.
3. "API 생성" 버튼을 클릭합니다.
4. "REST API" 선택 후 "구축"을 클릭합니다.
5. API 이름을 "AI-Document-API"로 입력하고 "API 생성"을 클릭합니다.

## 2. 리소스 및 메서드 생성

### 인증 엔드포인트 생성

1. "리소스" 탭에서 "/"(루트) 리소스를 선택합니다.
2. "리소스 생성" 버튼을 클릭합니다.
3. 리소스 이름과 경로를 "fast_api"로 입력하고 "리소스 생성"을 클릭합니다.
4. "fast_api" 리소스를 선택하고 "리소스 생성" 버튼을 클릭합니다.
5. 리소스 이름과 경로를 "auth"로 입력하고 "리소스 생성"을 클릭합니다.
6. "auth" 리소스를 선택하고 "리소스 생성" 버튼을 클릭합니다.
7. 리소스 이름과 경로를 "me"로 입력하고 "리소스 생성"을 클릭합니다.
8. "me" 리소스를 선택하고 "메서드 생성" 버튼을 클릭합니다.
9. 드롭다운에서 "GET"을 선택하고 체크 표시를 클릭합니다.
10. 통합 유형으로 "Lambda 함수"를 선택합니다.
11. Lambda 함수 이름에 "ai-document-api-auth"를 입력하고 "저장"을 클릭합니다.

### 토큰 엔드포인트 생성

1. "auth" 리소스를 선택하고 "리소스 생성" 버튼을 클릭합니다.
2. 리소스 이름과 경로를 "token"으로 입력하고 "리소스 생성"을 클릭합니다.
3. "token" 리소스를 선택하고 "메서드 생성" 버튼을 클릭합니다.
4. 드롭다운에서 "POST"를 선택하고 체크 표시를 클릭합니다.
5. 통합 유형으로 "Lambda 함수"를 선택합니다.
6. Lambda 함수 이름에 "ai-document-api-auth"를 입력하고 "저장"을 클릭합니다.

### 회원가입 엔드포인트 생성

1. "auth" 리소스를 선택하고 "리소스 생성" 버튼을 클릭합니다.
2. 리소스 이름과 경로를 "register"로 입력하고 "리소스 생성"을 클릭합니다.
3. "register" 리소스를 선택하고 "메서드 생성" 버튼을 클릭합니다.
4. 드롭다운에서 "POST"를 선택하고 체크 표시를 클릭합니다.
5. 통합 유형으로 "Lambda 함수"를 선택합니다.
6. Lambda 함수 이름에 "ai-document-api-auth"를 입력하고 "저장"을 클릭합니다.

### 사용자 엔드포인트 생성

1. "fast_api" 리소스를 선택하고 "리소스 생성" 버튼을 클릭합니다.
2. 리소스 이름과 경로를 "users"로 입력하고 "리소스 생성"을 클릭합니다.
3. "users" 리소스를 선택하고 "메서드 생성" 버튼을 클릭합니다.
4. 드롭다운에서 "GET"을 선택하고 체크 표시를 클릭합니다.
5. 통합 유형으로 "Lambda 함수"를 선택합니다.
6. Lambda 함수 이름에 "ai-document-api-users"를 입력하고 "저장"을 클릭합니다.

### 문서 구조 엔드포인트 생성

1. "fast_api" 리소스를 선택하고 "리소스 생성" 버튼을 클릭합니다.
2. 리소스 이름과 경로를 "documents"로 입력하고 "리소스 생성"을 클릭합니다.
3. "documents" 리소스를 선택하고 "리소스 생성" 버튼을 클릭합니다.
4. 리소스 이름과 경로를 "structure"로 입력하고 "리소스 생성"을 클릭합니다.
5. "structure" 리소스를 선택하고 "메서드 생성" 버튼을 클릭합니다.
6. 드롭다운에서 "GET"을 선택하고 체크 표시를 클릭합니다.
7. 통합 유형으로 "Lambda 함수"를 선택합니다.
8. Lambda 함수 이름에 "ai-document-api-documents"를 입력하고 "저장"을 클릭합니다.

## 3. API 배포

1. "작업" 드롭다운 메뉴를 클릭합니다.
2. "API 배포"를 선택합니다.
3. 스테이지 드롭다운에서 "새 스테이지"를 선택합니다.
4. 스테이지 이름에 "api"를 입력합니다.
5. "배포" 버튼을 클릭합니다.

## 4. API URL 확인

1. 왼쪽 탐색 창에서 "스테이지"를 클릭합니다.
2. "api" 스테이지를 선택합니다.
3. 스테이지 편집기에서 "호출 URL"을 확인합니다.

이제 다음 엔드포인트로 API를 호출할 수 있습니다:

- `GET    https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/auth/me`
- `POST   https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/auth/token`
- `POST   https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/auth/register`
- `GET    https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/users`
- `GET    https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/documents/structure`