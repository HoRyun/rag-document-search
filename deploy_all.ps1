# 전체 배포 스크립트

# 0. 환경 변수 설정 (직접 설정)
if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/document_db"
    Write-Host "DATABASE_URL 환경 변수를 기본값으로 설정했습니다." -ForegroundColor Yellow
}

if (-not $env:SECRET_KEY) {
    $env:SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    Write-Host "SECRET_KEY 환경 변수를 기본값으로 설정했습니다." -ForegroundColor Yellow
}

if (-not $env:ALGORITHM) {
    $env:ALGORITHM = "HS256"
    Write-Host "ALGORITHM 환경 변수를 기본값으로 설정했습니다." -ForegroundColor Yellow
}

if (-not $env:ACCESS_TOKEN_EXPIRE_MINUTES) {
    $env:ACCESS_TOKEN_EXPIRE_MINUTES = "30"
    Write-Host "ACCESS_TOKEN_EXPIRE_MINUTES 환경 변수를 기본값으로 설정했습니다." -ForegroundColor Yellow
}

# 1. DB 레이어 생성
if (-not $env:DB_LAYER_ARN) {
    Write-Host "DB 레이어 생성 중..." -ForegroundColor Cyan
    . .\create_db_layer.ps1
    
    # 레이어 ARN 환경 변수 설정
    if (-not $env:DB_LAYER_ARN) {
        Write-Host "오류: DB 레이어 생성 후 DB_LAYER_ARN 환경 변수가 설정되지 않았습니다." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "기존 DB 레이어 사용: $env:DB_LAYER_ARN" -ForegroundColor Cyan
}

# 2. Lambda 함수 생성
Write-Host "Lambda 함수 생성 중..." -ForegroundColor Cyan
. .\create_functions.ps1

# 3. API Gateway 생성 및 연결
Write-Host "API Gateway 생성 및 연결 중..." -ForegroundColor Cyan
. .\create_api_gateway.ps1

Write-Host "전체 배포가 완료되었습니다!" -ForegroundColor Green
Write-Host "참고: 모든 Lambda 함수는 x86_64 아키텍처로 생성되었습니다." -ForegroundColor Cyan