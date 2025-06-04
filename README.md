# Lambda API 배포 가이드

## 개요

이 프로젝트는 다음 API 엔드포인트를 별도의 Lambda 함수로 분할합니다:

- Auth Lambda: `/fast_api/auth/me`, `/fast_api/auth/token`, `/fast_api/auth/register`
- Users Lambda: `/fast_api/users`
- Documents Lambda: `/fast_api/documents/structure`

## 시스템 요구사항

- AWS Lambda x86_64 아키텍처
- Python 3.12 런타임
- AWS CLI가 설치되고 구성됨
- PowerShell 5.1 이상

## 배포 방법

### 1. 환경 변수 설정 (두 가지 방법)

#### 방법 1: 직접 실행 (권장)
스크립트에 기본 환경 변수가 포함되어 있어 별도 설정 없이 바로 실행 가능합니다.

```powershell
# 전체 배포 스크립트 실행
.\deploy_all.ps1
```

#### 방법 2: 환경 변수 직접 설정
필요한 경우 환경 변수를 직접 설정할 수 있습니다.

```powershell
# 필수 환경 변수 설정
$env:DATABASE_URL = "postgresql://username:password@host:port/dbname"
$env:SECRET_KEY = "your-secret-key"
$env:ALGORITHM = "HS256"
$env:ACCESS_TOKEN_EXPIRE_MINUTES = "30"

# 전체 배포 스크립트 실행
.\deploy_all.ps1
```

#### 방법 3: .env 파일 사용
.env 파일을 생성하고 환경 변수를 설정한 후 set_env.ps1 스크립트를 실행합니다.

1. .env 파일 생성:
   ```
   DATABASE_URL=postgresql://username:password@host:port/dbname
   SECRET_KEY=your-secret-key
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   ```

2. 환경 변수 설정 스크립트 실행:
   ```powershell
   .\set_env.ps1
   ```

3. 배포 스크립트 실행:
   ```powershell
   .\deploy_all.ps1
   ```

### 2. 단계별 수동 배포

각 단계를 개별적으로 실행하려면:

1. DB 레이어 생성:
   ```powershell
   .\create_db_layer.ps1
   ```

2. Lambda 함수 생성:
   ```powershell
   .\create_functions.ps1
   ```

3. API Gateway 생성 및 연결:
   ```powershell
   .\create_api_gateway.ps1
   ```

## 배포 후 테스트

배포가 완료되면 다음 URL로 API를 테스트할 수 있습니다:

- `GET    https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/auth/me`
- `POST   https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/auth/token`
- `POST   https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/auth/register`
- `GET    https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/users`
- `GET    https://{api-id}.execute-api.{region}.amazonaws.com/api/fast_api/documents/structure`

## 함수 코드 업데이트

Lambda 함수 코드만 업데이트하려면:

```powershell
.\deploy.ps1
```

## 아키텍처 정보

모든 Lambda 함수와 레이어는 x86_64 아키텍처를 사용합니다. ARM64 아키텍처(Graviton)는 지원하지 않습니다.