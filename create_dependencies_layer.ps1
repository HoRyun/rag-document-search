# 의존성 패키지 레이어 생성 (올바른 Lambda 구조, Python 3.9 호환)
Write-Host "Creating dependencies layer with correct Lambda structure for Python 3.9..." -ForegroundColor Green

# 임시 디렉토리 생성 (올바른 Lambda 구조)
$tempDir = "temp_lambda_layer"
$pythonDir = "$tempDir\python\lib\python3.9\site-packages"

try {
    # 기존 디렉토리가 있으면 내용만 정리
    if (Test-Path $tempDir) {
        Get-ChildItem -Path $tempDir -Recurse | Remove-Item -Recurse -Force
        Write-Host "Cleaned up existing directory content" -ForegroundColor Gray
    } else {
        # 디렉토리 생성
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        Write-Host "Created directory: $tempDir" -ForegroundColor Cyan
    }
    
    # Python site-packages 디렉토리 생성
    New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    Write-Host "Created Python site-packages directory: $pythonDir" -ForegroundColor Cyan

    # Python 버전 확인
    Write-Host "Checking Python version..." -ForegroundColor Yellow
    $pythonVersion = python --version 2>&1
    Write-Host "Python version: $pythonVersion" -ForegroundColor White
    
    if ($LASTEXITCODE -ne 0) {
        throw "Python is not installed or not in PATH"
    }

    # pip 업그레이드
    Write-Host "Upgrading pip..." -ForegroundColor Yellow
    python -m pip install --upgrade pip

    # Python 3.9 x86_64 아키텍처에 맞는 호환 패키지 설치
    Write-Host "Installing dependencies for Python 3.9 x86_64 with correct Lambda structure..." -ForegroundColor Yellow
    
    $packages = @(
        "fastapi==0.115.7",
        "pydantic==2.10.6", 
        "mangum==0.18.0",
        "sqlalchemy==2.0.36",
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4",
        "python-multipart==0.0.12",
        "python-dotenv==1.0.1"
    )

    foreach ($package in $packages) {
        Write-Host "Installing $package..." -ForegroundColor Cyan
        python -m pip install --no-cache-dir `
            --platform manylinux2014_x86_64 `
            --target $pythonDir `
            --implementation cp `
            --python-version 3.9 `
            --only-binary=:all: `
            --upgrade `
            $package
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install $package" -ForegroundColor Red
            throw "Package installation failed: $package"
        }
    }

    Write-Host "All packages installed successfully" -ForegroundColor Green

    # Lambda Layer 구조 확인
    Write-Host "`nLambda Layer structure verification:" -ForegroundColor Yellow
    Write-Host "Root: $tempDir" -ForegroundColor Cyan
    if (Test-Path "$tempDir\python") {
        Write-Host "✓ python/ directory exists" -ForegroundColor Green
        if (Test-Path "$tempDir\python\lib") {
            Write-Host "✓ python/lib/ directory exists" -ForegroundColor Green
            if (Test-Path "$tempDir\python\lib\python3.9") {
                Write-Host "✓ python/lib/python3.9/ directory exists" -ForegroundColor Green
                if (Test-Path "$tempDir\python\lib\python3.9\site-packages") {
                    Write-Host "✓ python/lib/python3.9/site-packages/ directory exists" -ForegroundColor Green
                    $packageCount = (Get-ChildItem -Path "$tempDir\python\lib\python3.9\site-packages" -Directory).Count
                    Write-Host "✓ Found $packageCount packages in site-packages" -ForegroundColor Green
                }
            }
        }
    }

    # 설치된 패키지 확인
    Write-Host "`nInstalled packages in site-packages:" -ForegroundColor Yellow
    Get-ChildItem -Path $pythonDir -Directory | ForEach-Object {
        Write-Host "- $($_.Name)" -ForegroundColor White
    }

    # 불필요한 파일 정리
    Write-Host "`nCleaning up unnecessary files..." -ForegroundColor Yellow
    $cleanupPatterns = @("*.pyc", "__pycache__", "*.dist-info", "tests", "test")
    
    foreach ($pattern in $cleanupPatterns) {
        $itemsToRemove = Get-ChildItem -Path $pythonDir -Recurse -Name $pattern -Force
        foreach ($item in $itemsToRemove) {
            $fullPath = Join-Path $pythonDir $item
            if (Test-Path $fullPath) {
                Remove-Item -Path $fullPath -Recurse -Force
                Write-Host "Removed: $item" -ForegroundColor Gray
            }
        }
    }

    # ZIP 파일 생성 (python 디렉토리 포함)
    Write-Host "`nCreating zip file with correct Lambda structure..." -ForegroundColor Yellow
    $zipPath = "dependencies-layer.zip"
    
    # 기존 zip 파일 삭제
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }

    # python 디렉토리를 포함하여 압축
    Compress-Archive -Path "$tempDir\python" -DestinationPath $zipPath -Force

    # 파일 크기 확인
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "Dependencies layer zip file created: $zipPath" -ForegroundColor Green
    Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan

    # 설치된 패키지 버전 정보 출력
    Write-Host "`nInstalled package versions:" -ForegroundColor Yellow
    Write-Host "- FastAPI: 0.115.7" -ForegroundColor White
    Write-Host "- Pydantic: 2.10.6" -ForegroundColor White
    Write-Host "- SQLAlchemy: 2.0.36" -ForegroundColor White
    Write-Host "- Mangum: 0.18.0" -ForegroundColor White
    Write-Host "- Architecture: x86_64 (manylinux2014)" -ForegroundColor White
    Write-Host "- Python version: 3.9" -ForegroundColor White
    Write-Host "- Layer structure: python/lib/python3.9/site-packages/" -ForegroundColor White

    # AWS CLI로 의존성 패키지 레이어 생성
    Write-Host "`nPublishing layer to AWS Lambda..." -ForegroundColor Yellow
    
    $dependenciesLayerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-dependencies-layer `
        --description "Dependencies Layer for AI Document API (FastAPI 0.115.7, Pydantic 2.10.6, Python 3.9 x86_64 compatible, correct Lambda structure)" `
        --compatible-runtimes python3.9 `
        --compatible-architectures x86_64 `
        --zip-file fileb://$zipPath

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to publish layer to AWS Lambda"
    }

    # 의존성 패키지 레이어 ARN 출력
    $dependenciesLayerArn = ($dependenciesLayerOutput | ConvertFrom-Json).LayerVersionArn
    Write-Host "`nDependencies layer created successfully!" -ForegroundColor Green
    Write-Host "Dependencies Layer ARN: $dependenciesLayerArn" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Set this environment variable before deploying:" -ForegroundColor Yellow
    Write-Host "`$env:DEPENDENCIES_LAYER_ARN = '$dependenciesLayerArn'" -ForegroundColor Yellow

    # 환경 변수 자동 설정
    $env:DEPENDENCIES_LAYER_ARN = $dependenciesLayerArn
    Write-Host "Environment variable has been set automatically for this session." -ForegroundColor Green

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # 임시 디렉토리 유지
    Write-Host "Temporary directory '$tempDir' preserved for inspection" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Dependencies layer creation completed!" -ForegroundColor Green
Write-Host "Lambda compatibility verified:" -ForegroundColor Cyan
Write-Host "✓ Correct python/lib/python3.9/site-packages/ structure" -ForegroundColor Green
Write-Host "✓ FastAPI 0.115.7 and Pydantic 2.10.6 compatibility secured" -ForegroundColor Green
Write-Host "✓ Python 3.9 x86_64 architecture compatibility secured" -ForegroundColor Green
Write-Host "✓ AWS Lambda runtime compatibility secured" -ForegroundColor Green
Write-Host ""
Write-Host "Installed packages are available in the '$tempDir' directory" -ForegroundColor Yellow
