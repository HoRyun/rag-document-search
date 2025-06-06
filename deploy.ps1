# 1. Lambda 함수 코드 패키징
Write-Host "Lambda 함수 코드 패키징 중..."

# auth 함수 패키징
New-Item -Path "package\auth" -ItemType Directory -Force
Copy-Item -Path "lambda_auth.py" -Destination "package\auth\" -Force
Compress-Archive -Path "package\auth\*" -DestinationPath "auth_function.zip" -Force

# users 함수 패키징
New-Item -Path "package\users" -ItemType Directory -Force
Copy-Item -Path "lambda_users.py" -Destination "package\users\" -Force
Compress-Archive -Path "package\users\*" -DestinationPath "users_function.zip" -Force

# documents 함수 패키징
New-Item -Path "package\documents" -ItemType Directory -Force
Copy-Item -Path "lambda_documents.py" -Destination "package\documents\" -Force
Compress-Archive -Path "package\documents\*" -DestinationPath "documents_function.zip" -Force

# 2. Lambda 함수 업로드 및 업데이트
Write-Host "Lambda 함수 업로드 중..."

# auth 함수 업데이트
aws lambda update-function-code `
    --function-name ai-document-api-auth `
    --zip-file fileb://auth_function.zip `
    --architectures x86_64

# users 함수 업데이트
aws lambda update-function-code `
    --function-name ai-document-api-users `
    --zip-file fileb://users_function.zip `
    --architectures x86_64

# documents 함수 업데이트
aws lambda update-function-code `
    --function-name ai-document-api-documents `
    --zip-file fileb://documents_function.zip `
    --architectures x86_64

Write-Host "Lambda 함수 업데이트 완료!" -ForegroundColor Green