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

# 2. 레이어 ARN 확인
if (-not $env:DB_LAYER_ARN) {
    Write-Host "오류: DB_LAYER_ARN 환경 변수가 설정되지 않았습니다." -ForegroundColor Red
    exit 1
}

# 3. Lambda 함수 생성
Write-Host "Lambda 함수 생성 중..."

# 실행 역할 생성 (이미 있다면 ARN을 직접 지정)
$roleName = "document-management-Lambda"
$roleArn = ""

try {
    # 역할이 이미 존재하는지 확인
    $roleCheck = aws iam get-role --role-name $roleName 2>$null
    if ($roleCheck) {
        $roleArn = ($roleCheck | ConvertFrom-Json).Role.Arn
        Write-Host "기존 역할 사용: $roleArn"
    }
} catch {
    # 역할 생성
    Write-Host "Lambda 실행 역할 생성 중..."
    $trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@
    $trustPolicy | Out-File -FilePath "trust-policy.json" -Encoding utf8
    
    $roleOutput = aws iam create-role --role-name $roleName --assume-role-policy-document file://trust-policy.json
    $roleArn = ($roleOutput | ConvertFrom-Json).Role.Arn
    
    # 기본 Lambda 실행 정책 연결
    aws iam attach-role-policy --role-name $roleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    # 5초 대기 (역할 생성 후 사용 가능해질 때까지)
    Start-Sleep -Seconds 5
}

# 환경 변수 설정
$envVars = @{
    Variables = @{
        DATABASE_URL = $env:DATABASE_URL
        SECRET_KEY = $env:SECRET_KEY
        ALGORITHM = $env:ALGORITHM
        ACCESS_TOKEN_EXPIRE_MINUTES = $env:ACCESS_TOKEN_EXPIRE_MINUTES
    }
} | ConvertTo-Json -Compress

# auth 함수 생성
Write-Host "auth Lambda 함수 생성 중..."
aws lambda create-function `
    --function-name ai-document-api-auth `
    --runtime python3.12 `
    --handler lambda_auth.handler `
    --role $roleArn `
    --zip-file fileb://auth_function.zip `
    --layers $env:DB_LAYER_ARN `
    --environment $envVars `
    --timeout 30 `
    --architectures x86_64

# users 함수 생성
Write-Host "users Lambda 함수 생성 중..."
aws lambda create-function `
    --function-name ai-document-api-users `
    --runtime python3.12 `
    --handler lambda_users.handler `
    --role $roleArn `
    --zip-file fileb://users_function.zip `
    --layers $env:DB_LAYER_ARN `
    --environment $envVars `
    --timeout 30 `
    --architectures x86_64

# documents 함수 생성
Write-Host "documents Lambda 함수 생성 중..."
aws lambda create-function `
    --function-name ai-document-api-documents `
    --runtime python3.12 `
    --handler lambda_documents.handler `
    --role $roleArn `
    --zip-file fileb://documents_function.zip `
    --layers $env:DB_LAYER_ARN `
    --environment $envVars `
    --timeout 30 `
    --architectures x86_64

Write-Host "Lambda 함수 생성 완료!" -ForegroundColor Green