# API Gateway 생성 및 Lambda 함수 연결 스크립트

# 1. API Gateway 생성
Write-Host "API Gateway 생성 중..."
$apiOutput = aws apigateway create-rest-api --name "AI-Document-API" --endpoint-configuration "{ ""types"": [""REGIONAL""] }"
$apiOutput
$apiId = ($apiOutput | ConvertFrom-Json).id
Write-Host "API ID: $apiId"

if (-not $apiId) {
    Write-Host "오류: API ID를 가져올 수 없습니다." -ForegroundColor Red
    exit 1
}

# 2. 루트 리소스 ID 가져오기
$resourcesOutput = aws apigateway get-resources --rest-api-id "$apiId"
$resourcesOutput
$rootResourceId = ($resourcesOutput | ConvertFrom-Json).items[0].id
Write-Host "루트 리소스 ID: $rootResourceId"

if (-not $rootResourceId) {
    Write-Host "오류: 루트 리소스 ID를 가져올 수 없습니다." -ForegroundColor Red
    exit 1
}

# 3. 리소스 경로 생성
# /fast_api
Write-Host "/fast_api 리소스 생성 중..."
$fastApiOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$rootResourceId" --path-part "fast_api"
$fastApiId = ($fastApiOutput | ConvertFrom-Json).id
Write-Host "/fast_api 리소스 ID: $fastApiId"

# /fast_api/auth
Write-Host "/fast_api/auth 리소스 생성 중..."
$authOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$fastApiId" --path-part "auth"
$authId = ($authOutput | ConvertFrom-Json).id
Write-Host "/fast_api/auth 리소스 ID: $authId"

# /fast_api/auth/me
Write-Host "/fast_api/auth/me 리소스 생성 중..."
$meOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$authId" --path-part "me"
$meId = ($meOutput | ConvertFrom-Json).id
Write-Host "/fast_api/auth/me 리소스 ID: $meId"

# /fast_api/auth/token
Write-Host "/fast_api/auth/token 리소스 생성 중..."
$tokenOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$authId" --path-part "token"
$tokenId = ($tokenOutput | ConvertFrom-Json).id
Write-Host "/fast_api/auth/token 리소스 ID: $tokenId"

# /fast_api/auth/register
Write-Host "/fast_api/auth/register 리소스 생성 중..."
$registerOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$authId" --path-part "register"
$registerId = ($registerOutput | ConvertFrom-Json).id
Write-Host "/fast_api/auth/register 리소스 ID: $registerId"

# /fast_api/users
Write-Host "/fast_api/users 리소스 생성 중..."
$usersOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$fastApiId" --path-part "users"
$usersId = ($usersOutput | ConvertFrom-Json).id
Write-Host "/fast_api/users 리소스 ID: $usersId"

# /fast_api/documents
Write-Host "/fast_api/documents 리소스 생성 중..."
$documentsOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$fastApiId" --path-part "documents"
$documentsId = ($documentsOutput | ConvertFrom-Json).id
Write-Host "/fast_api/documents 리소스 ID: $documentsId"

# /fast_api/documents/structure
Write-Host "/fast_api/documents/structure 리소스 생성 중..."
$structureOutput = aws apigateway create-resource --rest-api-id "$apiId" --parent-id "$documentsId" --path-part "structure"
$structureId = ($structureOutput | ConvertFrom-Json).id
Write-Host "/fast_api/documents/structure 리소스 ID: $structureId"

# 4. Lambda 함수 ARN 가져오기
$region = aws configure get region
if (-not $region) {
    $region = "ap-northeast-2"  # 기본 리전
}
$accountId = aws sts get-caller-identity --query "Account" --output text
Write-Host "계정 ID: $accountId"
Write-Host "리전: $region"

$authFunctionArn = "arn:aws:lambda:${region}:${accountId}:function:ai-document-api-auth"
$usersFunctionArn = "arn:aws:lambda:${region}:${accountId}:function:ai-document-api-users"
$documentsFunctionArn = "arn:aws:lambda:${region}:${accountId}:function:ai-document-api-documents"

Write-Host "Auth 함수 ARN: $authFunctionArn"
Write-Host "Users 함수 ARN: $usersFunctionArn"
Write-Host "Documents 함수 ARN: $documentsFunctionArn"

# 5. 메서드 및 통합 생성
# /fast_api/auth/me - GET
Write-Host "/fast_api/auth/me GET 메서드 생성 중..."
aws apigateway put-method --rest-api-id "$apiId" --resource-id "$meId" --http-method GET --authorization-type "NONE"
aws apigateway put-integration --rest-api-id "$apiId" --resource-id "$meId" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${authFunctionArn}/invocations"

# /fast_api/auth/token - POST
Write-Host "/fast_api/auth/token POST 메서드 생성 중..."
aws apigateway put-method --rest-api-id "$apiId" --resource-id "$tokenId" --http-method POST --authorization-type "NONE"
aws apigateway put-integration --rest-api-id "$apiId" --resource-id "$tokenId" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${authFunctionArn}/invocations"

# /fast_api/auth/register - POST
Write-Host "/fast_api/auth/register POST 메서드 생성 중..."
aws apigateway put-method --rest-api-id "$apiId" --resource-id "$registerId" --http-method POST --authorization-type "NONE"
aws apigateway put-integration --rest-api-id "$apiId" --resource-id "$registerId" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${authFunctionArn}/invocations"

# /fast_api/users - GET
Write-Host "/fast_api/users GET 메서드 생성 중..."
aws apigateway put-method --rest-api-id "$apiId" --resource-id "$usersId" --http-method GET --authorization-type "NONE"
aws apigateway put-integration --rest-api-id "$apiId" --resource-id "$usersId" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${usersFunctionArn}/invocations"

# /fast_api/documents/structure - GET
Write-Host "/fast_api/documents/structure GET 메서드 생성 중..."
aws apigateway put-method --rest-api-id "$apiId" --resource-id "$structureId" --http-method GET --authorization-type "NONE"
aws apigateway put-integration --rest-api-id "$apiId" --resource-id "$structureId" --http-method GET --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${documentsFunctionArn}/invocations"

# 6. Lambda 권한 추가
Write-Host "Lambda 권한 추가 중..."
aws lambda add-permission --function-name ai-document-api-auth --statement-id apigateway-auth --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*/*"
aws lambda add-permission --function-name ai-document-api-users --statement-id apigateway-users --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*/*"
aws lambda add-permission --function-name ai-document-api-documents --statement-id apigateway-documents --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*/*"

# 7. API 배포
Write-Host "API 배포 중..."
$deployOutput = aws apigateway create-deployment --rest-api-id "$apiId" --stage-name api
$deploymentId = ($deployOutput | ConvertFrom-Json).id
Write-Host "배포 ID: $deploymentId"

# 8. API URL 출력
$apiUrl = "https://${apiId}.execute-api.${region}.amazonaws.com/api"
Write-Host "API Gateway 배포 완료!" -ForegroundColor Green
Write-Host "API URL: $apiUrl" -ForegroundColor Cyan
Write-Host "엔드포인트:"
Write-Host "  GET    $apiUrl/fast_api/auth/me"
Write-Host "  POST   $apiUrl/fast_api/auth/token"
Write-Host "  POST   $apiUrl/fast_api/auth/register"
Write-Host "  GET    $apiUrl/fast_api/users"
Write-Host "  GET    $apiUrl/fast_api/documents/structure"