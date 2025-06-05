# 1. Lambda 함수 코드 패키징
Write-Host "Lambda 함수 코드 패키징 중..." -ForegroundColor Cyan

# auth 함수 패키징
New-Item -Path "package\auth" -ItemType Directory -Force
Copy-Item -Path "lambda_auth.py" -Destination "package\auth\" -Force
Compress-Archive -Path "package\auth\*" -DestinationPath "auth_function.zip" -Force
Write-Host "✓ auth 함수 패키징 완료" -ForegroundColor Green

# users 함수 패키징
New-Item -Path "package\users" -ItemType Directory -Force
Copy-Item -Path "lambda_users.py" -Destination "package\users\" -Force
Compress-Archive -Path "package\users\*" -DestinationPath "users_function.zip" -Force
Write-Host "✓ users 함수 패키징 완료" -ForegroundColor Green

# documents 함수 패키징
New-Item -Path "package\documents" -ItemType Directory -Force
Copy-Item -Path "lambda_documents.py" -Destination "package\documents\" -Force
Compress-Archive -Path "package\documents\*" -DestinationPath "documents_function.zip" -Force
Write-Host "✓ documents 함수 패키징 완료" -ForegroundColor Green

# 2. 환경 변수 설정 (JSON 파일 방식 대신 직접 설정)
Write-Host "환경 변수 준비 중..." -ForegroundColor Cyan

# 환경 변수 문자열 직접 생성 (JSON 파싱 오류 방지)
$envString = "Variables={DATABASE_URL=$($env:DATABASE_URL),SECRET_KEY=$($env:SECRET_KEY),ALGORITHM=$($env:ALGORITHM),ACCESS_TOKEN_EXPIRE_MINUTES=$($env:ACCESS_TOKEN_EXPIRE_MINUTES)}"

Write-Host "환경 변수 문자열 생성 완료" -ForegroundColor Green

# 3. Lambda 함수 생성 (환경 변수 없이)
Write-Host "`nLambda 함수 생성 중..." -ForegroundColor Cyan

$roleName = "document-management-Lambda"
$roleArn = "arn:aws:iam::286857866962:role/document-management-Lambda"

# auth 함수 생성
Write-Host "`nauth Lambda 함수 생성 중..." -ForegroundColor Cyan
aws lambda create-function `
    --function-name ai-document-api-auth `
    --runtime python3.11 `
    --handler lambda_auth.handler `
    --role $roleArn `
    --zip-file fileb://auth_function.zip `
    --timeout 30 `
    --architectures x86_64

# auth 함수 환경 변수 설정 (수정된 방식)
Write-Host "auth 함수 환경 변수 설정 중..." -ForegroundColor Yellow
aws lambda update-function-configuration `
    --function-name ai-document-api-auth `
    --environment $envString

# users 함수 생성
Write-Host "`nusers Lambda 함수 생성 중..." -ForegroundColor Cyan
aws lambda create-function `
    --function-name ai-document-api-users `
    --runtime python3.11 `
    --handler lambda_users.handler `
    --role $roleArn `
    --zip-file fileb://users_function.zip `
    --timeout 30 `
    --architectures x86_64

# users 함수 환경 변수 설정 (수정된 방식)
Write-Host "users 함수 환경 변수 설정 중..." -ForegroundColor Yellow
aws lambda update-function-configuration `
    --function-name ai-document-api-users `
    --environment $envString

# documents 함수 생성
Write-Host "`ndocuments Lambda 함수 생성 중..." -ForegroundColor Cyan
aws lambda create-function `
    --function-name ai-document-api-documents `
    --runtime python3.11 `
    --handler lambda_documents.handler `
    --role $roleArn `
    --zip-file fileb://documents_function.zip `
    --timeout 30 `
    --architectures x86_64

# documents 함수 환경 변수 설정 (수정된 방식)
Write-Host "documents 함수 환경 변수 설정 중..." -ForegroundColor Yellow
aws lambda update-function-configuration `
    --function-name ai-document-api-documents `
    --environment $envString

# 4. 정리 (JSON 파일 제거 부분 삭제)
Write-Host "`nLambda 함수 생성 및 환경 변수 설정 완료!" -ForegroundColor Green
Write-Host "각 함수에 필요한 레이어는 별도로 추가해야 합니다." -ForegroundColor Yellow
