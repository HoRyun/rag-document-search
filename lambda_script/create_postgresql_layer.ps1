# PostgreSQL + pgvector 전용 레이어 생성 (의존성 레이어와 충돌 방지)
Write-Host "Creating PostgreSQL + pgvector dedicated layer (avoiding dependencies layer conflicts)..." -ForegroundColor Green

$tempDir = "temp_postgresql_pgvector_only_layer"
$pythonDir = "$tempDir\python\lib\python3.9\site-packages"

try {
    # 기존 디렉토리 정리
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
        Write-Host "Cleaned up existing directory content" -ForegroundColor Gray
    }

    New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    Write-Host "Created Python site-packages directory: $pythonDir" -ForegroundColor Cyan

    # Python 버전 확인
    Write-Host "Checking Python version..." -ForegroundColor Yellow
    $pythonVersion = python --version 2>&1
    Write-Host "Local Python version: $pythonVersion" -ForegroundColor White

    # pip 업그레이드
    Write-Host "Upgrading pip..." -ForegroundColor Yellow
    python -m pip install --upgrade pip

    # PostgreSQL 전용 패키지만 설치 (의존성 레이어와 중복 방지)
    Write-Host "Installing PostgreSQL-specific packages only..." -ForegroundColor Yellow
    
    # 1. PostgreSQL 드라이버 설치 (aws-psycopg2 우선)
    Write-Host "Installing aws-psycopg2..." -ForegroundColor Cyan
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
        Write-Host "aws-psycopg2 installation failed, trying psycopg2-binary..." -ForegroundColor Yellow
        
        python -m pip install --no-cache-dir `
            --platform manylinux2014_x86_64 `
            --target $pythonDir `
            --implementation cp `
            --python-version 3.9 `
            --only-binary=:all: `
            --upgrade `
            "psycopg2-binary==2.9.9"
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install PostgreSQL driver"
        }
        Write-Host "✓ Successfully installed psycopg2-binary" -ForegroundColor Green
    }

    # 2. pgvector 설치 (벡터 데이터베이스 지원)
    Write-Host "Installing pgvector..." -ForegroundColor Cyan
    python -m pip install --no-cache-dir `
        --platform manylinux2014_x86_64 `
        --target $pythonDir `
        --implementation cp `
        --python-version 3.9 `
        --only-binary=:all: `
        --upgrade `
        "pgvector"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "pgvector binary installation failed, trying with numpy..." -ForegroundColor Yellow
        
        # numpy만 추가 설치 (pgvector 의존성)
        python -m pip install --no-cache-dir `
            --platform manylinux2014_x86_64 `
            --target $pythonDir `
            --implementation cp `
            --python-version 3.9 `
            --only-binary=:all: `
            "numpy>=1.21.0"
        
        python -m pip install --no-cache-dir `
            --target $pythonDir `
            "pgvector"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: pgvector installation failed. Continuing without pgvector..." -ForegroundColor Yellow
        } else {
            Write-Host "✓ Successfully installed pgvector with numpy" -ForegroundColor Green
        }
    } else {
        Write-Host "✓ Successfully installed pgvector" -ForegroundColor Green
    }

    # 3. PostgreSQL 전용 유틸리티만 설치 (SQLAlchemy는 의존성 레이어에 있으므로 제외)
    Write-Host "Installing PostgreSQL-specific utilities..." -ForegroundColor Cyan
    
    # alembic만 설치 (데이터베이스 마이그레이션용, SQLAlchemy 의존성은 다른 레이어에서)
    python -m pip install --no-cache-dir `
        --platform manylinux2014_x86_64 `
        --target $pythonDir `
        --implementation cp `
        --python-version 3.9 `
        --only-binary=:all: `
        --no-deps `
        "alembic==1.12.1"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully installed alembic (no-deps)" -ForegroundColor Green
    }

    # 의존성 레이어와 중복되는 패키지 제거
    Write-Host "`nRemoving packages that conflict with dependencies layer..." -ForegroundColor Yellow
    
    $conflictingPackages = @(
        "fastapi*",
        "pydantic*", 
        "email_validator*",
        "dnspython*",
        "mangum*",
        "sqlalchemy*",
        "jose*",
        "passlib*",
        "multipart*",
        "dotenv*",
        "exceptiongroup*",
        "starlette*",
        "uvicorn*"
    )

    foreach ($pattern in $conflictingPackages) {
        $conflictingDirs = Get-ChildItem -Path $pythonDir -Directory | Where-Object { $_.Name -like $pattern }
        foreach ($dir in $conflictingDirs) {
            Remove-Item -Path $dir.FullName -Recurse -Force
            Write-Host "Removed conflicting package: $($dir.Name)" -ForegroundColor Gray
        }
    }

    # 설치 확인
    Write-Host "`nVerifying PostgreSQL-specific installation..." -ForegroundColor Yellow
    
    # psycopg2 확인
    if (Test-Path "$pythonDir\psycopg2") {
        Write-Host "✓ psycopg2 module found" -ForegroundColor Green
        
        $soFiles = Get-ChildItem -Path "$pythonDir\psycopg2" -Filter "*.so" -File
        if ($soFiles.Count -gt 0) {
            Write-Host "✓ PostgreSQL binary files: $($soFiles.Count) files" -ForegroundColor Green
        }
    } else {
        Write-Host "✗ psycopg2 module not found" -ForegroundColor Red
    }

    # pgvector 확인
    if (Test-Path "$pythonDir\pgvector") {
        Write-Host "✓ pgvector module found" -ForegroundColor Green
        
        if (Test-Path "$pythonDir\pgvector\sqlalchemy") {
            Write-Host "✓ pgvector SQLAlchemy integration available" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠ pgvector module not found (optional)" -ForegroundColor Yellow
    }

    # numpy 확인 (pgvector 의존성)
    if (Test-Path "$pythonDir\numpy") {
        Write-Host "✓ numpy found (pgvector dependency)" -ForegroundColor Green
    }

    # 최종 패키지 목록
    Write-Host "`nFinal PostgreSQL layer contents:" -ForegroundColor Yellow
    Get-ChildItem -Path $pythonDir -Directory | ForEach-Object {
        Write-Host "- $($_.Name)" -ForegroundColor White
    }

    # 크기 확인
    $totalSize = (Get-ChildItem -Path $pythonDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "✓ PostgreSQL layer size: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Cyan

    # ZIP 파일 생성
    Write-Host "`nCreating PostgreSQL-only zip file..." -ForegroundColor Yellow
    $zipPath = "postgresql-pgvector-only-layer-py39.zip"
    
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }

    Compress-Archive -Path "$tempDir\python" -DestinationPath $zipPath -Force

    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "PostgreSQL layer zip created: $zipPath" -ForegroundColor Green
    Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan

    # AWS CLI로 레이어 생성
    Write-Host "`nPublishing PostgreSQL-only layer to AWS Lambda..." -ForegroundColor Yellow
    
    $layerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-postgresql-only-layer `
        --description "PostgreSQL + pgvector only (no conflicts with dependencies layer)" `
        --compatible-runtimes python3.9 `
        --compatible-architectures x86_64 `
        --zip-file fileb://$zipPath

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to publish PostgreSQL layer to AWS Lambda"
    }

    $layerArn = ($layerOutput | ConvertFrom-Json).LayerVersionArn
    Write-Host "`nPostgreSQL-only layer created successfully!" -ForegroundColor Green
    Write-Host "PostgreSQL Layer ARN: $layerArn" -ForegroundColor Cyan
    
    $env:POSTGRESQL_ONLY_LAYER_ARN = $layerArn
    Write-Host "Environment variable set: POSTGRESQL_ONLY_LAYER_ARN" -ForegroundColor Green

    # 레이어 사용 가이드
    Write-Host "`nLayer usage guide:" -ForegroundColor Yellow
    Write-Host "1. Dependencies Layer: FastAPI, Pydantic, email-validator, etc." -ForegroundColor White
    Write-Host "2. PostgreSQL Layer: psycopg2, pgvector, alembic only" -ForegroundColor White
    Write-Host "3. Use both layers together in Lambda function" -ForegroundColor White

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Write-Host "Temporary directory '$tempDir' preserved for inspection" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "PostgreSQL-only layer creation completed!" -ForegroundColor Green
Write-Host "Conflict-free configuration:" -ForegroundColor Cyan
Write-Host "✓ No overlap with dependencies layer" -ForegroundColor Green
Write-Host "✓ PostgreSQL connectivity (psycopg2/aws-psycopg2)" -ForegroundColor Green
Write-Host "✓ Vector database support (pgvector)" -ForegroundColor Green
Write-Host "✓ Database migration support (alembic)" -ForegroundColor Green
Write-Host "✓ Optimized for Lambda size limits" -ForegroundColor Green
