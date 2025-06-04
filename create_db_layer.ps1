# DB 모듈 레이어 생성
New-Item -Path "layer\python" -ItemType Directory -Force
New-Item -Path "layer\python\db" -ItemType Directory -Force
New-Item -Path "layer\python\config" -ItemType Directory -Force
New-Item -Path "layer\python\fast_api" -ItemType Directory -Force

# 필요한 모듈 파일 복사
Copy-Item -Path "backend\db\*" -Destination "layer\python\db\" -Recurse -Force
Copy-Item -Path "backend\config\*" -Destination "layer\python\config\" -Recurse -Force
Copy-Item -Path "backend\fast_api\security.py" -Destination "layer\python\fast_api\" -Force

# 필요한 패키지 설치
pip install fastapi mangum sqlalchemy pydantic python-jose[cryptography] passlib[bcrypt] python-multipart -t layer\python

# 레이어 압축
Compress-Archive -Path "layer\python\*" -DestinationPath "db-layer.zip" -Force

# AWS CLI로 레이어 생성
$layerOutput = aws lambda publish-layer-version `
  --layer-name ai-document-api-db-layer `
  --description "DB Layer for AI Document API" `
  --compatible-runtimes python3.12 `
  --compatible-architectures x86_64 `
  --zip-file fileb://db-layer.zip

# 레이어 ARN 출력
$layerArn = ($layerOutput | ConvertFrom-Json).LayerVersionArn
Write-Host "Layer ARN: $layerArn"
Write-Host "Set this environment variable before deploying:"
Write-Host "`$env:DB_LAYER_ARN = '$layerArn'"

# 환경 변수 자동 설정
$env:DB_LAYER_ARN = $layerArn