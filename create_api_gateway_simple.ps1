# 간소화된 API Gateway 생성 스크립트

# 1. API Gateway 생성
Write-Host "API Gateway 생성 중..."
$apiOutput = aws apigateway create-rest-api --name "AI-Document-API" --endpoint-configuration "{ ""types"": [""REGIONAL""] }"
Write-Host $apiOutput

# JSON 문자열을 PowerShell 객체로 변환
$apiObj = $apiOutput | ConvertFrom-Json
$apiId = $apiObj.id
Write-Host "API ID: $apiId"

# 2. 루트 리소스 ID 가져오기
$resourcesOutput = aws apigateway get-resources --rest-api-id $apiId
Write-Host $resourcesOutput

$resourcesObj = $resourcesOutput | ConvertFrom-Json
$rootResourceId = $resourcesObj.items[0].id
Write-Host "루트 리소스 ID: $rootResourceId"

# 3. 프록시 리소스 생성 (모든 경로를 처리하는 단일 리소스)
Write-Host "프록시 리소스 생성 중..."
$proxyOutput = aws apigateway create-resource --rest-api-id $apiId --parent-id $rootResourceId --path-part "{proxy+}"
Write-Host $proxyOutput

$proxyObj = $proxyOutput | ConvertFrom-Json
$proxyId = $proxyObj.id
Write-Host "프록시 리소스 ID: $proxyId"

# 4. Lambda 함수 ARN 가져오기
$region = aws configure get region
if (-not $region) {
    $region = "ap-northeast-2"  # 기본 리전
}
$accountId = aws sts get-caller-identity --query "Account" --output text
Write-Host "계정 ID: $accountId"
Write-Host "리전: $region"

# 5. 프록시 리소스에 ANY 메서드 추가
Write-Host "ANY 메서드 생성 중..."
aws apigateway put-method --rest-api-id $apiId --resource-id $proxyId --http-method ANY --authorization-type "NONE" --request-parameters "method.request.path.proxy=true"

# 6. 각 Lambda 함수에 대한 통합 설정
# 경로 패턴에 따라 다른 Lambda 함수로 라우팅하는 통합 요청 템플릿 생성
$authFunctionArn = "arn:aws:lambda:${region}:${accountId}:function:ai-document-api-auth"
$usersFunctionArn = "arn:aws:lambda:${region}:${accountId}:function:ai-document-api-users"
$documentsFunctionArn = "arn:aws:lambda:${region}:${accountId}:function:ai-document-api-documents"

# 기본 함수로 auth 함수 사용
Write-Host "Lambda 통합 생성 중..."
aws apigateway put-integration --rest-api-id $apiId --resource-id $proxyId --http-method ANY --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${authFunctionArn}/invocations" --passthrough-behavior WHEN_NO_MATCH

# 7. Lambda 권한 추가
Write-Host "Lambda 권한 추가 중..."
aws lambda add-permission --function-name ai-document-api-auth --statement-id apigateway-auth --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*/*"
aws lambda add-permission --function-name ai-document-api-users --statement-id apigateway-users --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*/*"
aws lambda add-permission --function-name ai-document-api-documents --statement-id apigateway-documents --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${region}:${accountId}:${apiId}/*/*"

# 8. API 배포
Write-Host "API 배포 중..."
$deployOutput = aws apigateway create-deployment --rest-api-id $apiId --stage-name api
Write-Host $deployOutput

# 9. API URL 출력
$apiUrl = "https://${apiId}.execute-api.${region}.amazonaws.com/api"
Write-Host "API Gateway 배포 완료!" -ForegroundColor Green
Write-Host "API URL: $apiUrl" -ForegroundColor Cyan
Write-Host "참고: 이 API는 단일 프록시 리소스를 사용합니다. 각 Lambda 함수는 경로에 따라 요청을 처리해야 합니다."