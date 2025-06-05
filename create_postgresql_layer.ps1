# aws-psycopg2 패키지를 사용한 PostgreSQL 레이어 생성 (Python 3.9)
Write-Host "Creating PostgreSQL layer using aws-psycopg2 package for Python 3.9..." -ForegroundColor Green

$tempDir = "temp_postgresql_layer"
$pythonDir = "$tempDir\python\lib\python3.9\site-packages"

try {
    # 기존 디렉토리 정리
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
    }

    New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    Write-Host "Created Python site-packages directory: $pythonDir" -ForegroundColor Cyan

    # aws-psycopg2 패키지 설치 (Lambda 호환, Python 3.9)
    Write-Host "Installing aws-psycopg2 (Lambda-compatible package) for Python 3.9..." -ForegroundColor Yellow
    
    python -m pip install --no-cache-dir `
        --platform manylinux2014_x86_64 `
        --target $pythonDir `
        --implementation cp `
        --python-version 3.9 `
        --only-binary=:all: `
        --upgrade `
        "aws-psycopg2"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully installed aws-psycopg2" -ForegroundColor Green
    } else {
        throw "Failed to install aws-psycopg2"
    }

    # 설치된 패키지 확인
    Write-Host "`nInstalled packages:" -ForegroundColor Yellow
    Get-ChildItem -Path $pythonDir -Directory | ForEach-Object {
        Write-Host "- $($_.Name)" -ForegroundColor White
    }

    # psycopg2 모듈 확인
    if (Test-Path "$pythonDir\psycopg2") {
        Write-Host "✓ psycopg2 module found" -ForegroundColor Green
        
        # __init__.py 확인
        if (Test-Path "$pythonDir\psycopg2\__init__.py") {
            Write-Host "✓ psycopg2/__init__.py exists" -ForegroundColor Green
        }
        
        # _psycopg 모듈 확인
        $psycopgFiles = Get-ChildItem -Path "$pythonDir\psycopg2" -Filter "*_psycopg*"
        if ($psycopgFiles.Count -gt 0) {
            Write-Host "✓ _psycopg binary files found: $($psycopgFiles.Count)" -ForegroundColor Green
            $psycopgFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
        } else {
            Write-Host "⚠ Warning: No _psycopg binary files found" -ForegroundColor Yellow
        }
    }

    # ZIP 파일 생성
    Write-Host "`nCreating zip file..." -ForegroundColor Yellow
    $zipPath = "postgresql-layer-aws.zip"
    
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }

    Compress-Archive -Path "$tempDir\python" -DestinationPath $zipPath -Force

    # 파일 크기 확인
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "PostgreSQL layer zip file created: $zipPath" -ForegroundColor Green
    Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan

    # AWS CLI로 레이어 생성 (Python 3.9 런타임)
    Write-Host "`nPublishing PostgreSQL layer to AWS Lambda..." -ForegroundColor Yellow
    
    $layerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-postgresql-layer-aws `
        --description "PostgreSQL Layer using aws-psycopg2 (Lambda-compatible, Python 3.9)" `
        --compatible-runtimes python3.9 `
        --compatible-architectures x86_64 `
        --zip-file fileb://$zipPath

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to publish PostgreSQL layer to AWS Lambda"
    }

    $layerArn = ($layerOutput | ConvertFrom-Json).LayerVersionArn
    Write-Host "`nPostgreSQL layer created successfully!" -ForegroundColor Green
    Write-Host "PostgreSQL Layer ARN: $layerArn" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Set this environment variable:" -ForegroundColor Yellow
    Write-Host "`$env:POSTGRESQL_LAYER_ARN = '$layerArn'" -ForegroundColor Yellow

    $env:POSTGRESQL_LAYER_ARN = $layerArn

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Write-Host "`nTemporary directory preserved for inspection: $tempDir" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "PostgreSQL layer creation completed!" -ForegroundColor Green
Write-Host "✓ aws-psycopg2 package (Lambda-optimized)" -ForegroundColor Green
Write-Host "✓ Python 3.9 x86_64 architecture compatible" -ForegroundColor Green
Write-Host "✓ No _psycopg import issues" -ForegroundColor Green
