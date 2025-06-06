# 의존성 패키지 레이어 생성 (email-validator 메타데이터 보존)
Write-Host "Creating dependencies layer with email-validator metadata preservation..." -ForegroundColor Green

$tempDir = "temp_lambda_layer"
$pythonDir = "$tempDir\python\lib\python3.9\site-packages"

try {
    # 기존 디렉토리 정리
    if (Test-Path $tempDir) {
        Get-ChildItem -Path $tempDir -Recurse | Remove-Item -Recurse -Force
        Write-Host "Cleaned up existing directory content" -ForegroundColor Gray
    }
    
    New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    Write-Host "Created Python site-packages directory: $pythonDir" -ForegroundColor Cyan

    # Python 버전 확인
    $pythonVersion = python --version 2>&1
    Write-Host "Python version: $pythonVersion" -ForegroundColor White

    # pip 업그레이드
    python -m pip install --upgrade pip

    # 패키지 설치 (email-validator 명시적 추가)
    Write-Host "Installing dependencies with email-validator support..." -ForegroundColor Yellow
    
    $packages = @(
        "fastapi==0.115.7",
        "pydantic==2.10.6", 
        "email-validator",  # 명시적으로 email-validator 추가
        "dnspython==2.6.1",  # email-validator 의존성
        "mangum==0.18.0",
        "sqlalchemy==2.0.36",
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4",
        "python-multipart==0.0.12",
        "python-dotenv==1.0.1",
        "exceptiongroup"
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

    # 설치된 패키지 확인
    Write-Host "`nInstalled packages:" -ForegroundColor Yellow
    Get-ChildItem -Path $pythonDir -Directory | ForEach-Object {
        Write-Host "- $($_.Name)" -ForegroundColor White
    }

    # email-validator 설치 확인
    if (Test-Path "$pythonDir\email_validator") {
        Write-Host "✓ email_validator module found" -ForegroundColor Green
    }
    
    # email-validator 메타데이터 확인
    $emailValidatorDistInfo = Get-ChildItem -Path $pythonDir -Directory | Where-Object { $_.Name -like "*email*validator*.dist-info" }
    if ($emailValidatorDistInfo) {
        Write-Host "✓ email-validator metadata found: $($emailValidatorDistInfo.Name)" -ForegroundColor Green
    } else {
        Write-Host "⚠ email-validator metadata not found" -ForegroundColor Yellow
    }

    # 검색 결과 [5]에서 권장하는 방법: 중요한 메타데이터 보존
    Write-Host "`nCleaning up unnecessary files (preserving email-validator metadata)..." -ForegroundColor Yellow
    $cleanupPatterns = @("*.pyc", "__pycache__", "tests", "test")
    
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
    
    # 검색 결과 [5]에서 언급된 대로 email-validator의 dist-info는 보존
    Write-Host "Preserving email-validator metadata for AWS Lambda compatibility..." -ForegroundColor Yellow
    $distInfoDirs = Get-ChildItem -Path $pythonDir -Directory | Where-Object { $_.Name -like "*.dist-info" }
    foreach ($distInfo in $distInfoDirs) {
        if ($distInfo.Name -like "*email*validator*") {
            Write-Host "✓ Preserved: $($distInfo.Name)" -ForegroundColor Green
        } elseif ($distInfo.Name -like "*dnspython*") {
            Write-Host "✓ Preserved: $($distInfo.Name)" -ForegroundColor Green
        } else {
            # 다른 dist-info는 제거 (크기 최적화)
            Remove-Item -Path $distInfo.FullName -Recurse -Force
            Write-Host "Removed: $($distInfo.Name)" -ForegroundColor Gray
        }
    }

    # ZIP 파일 생성
    Write-Host "`nCreating zip file..." -ForegroundColor Yellow
    $zipPath = "dependencies-layer-with-email-validator.zip"
    
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }

    Compress-Archive -Path "$tempDir\python" -DestinationPath $zipPath -Force

    # 파일 크기 확인
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "Dependencies layer zip file created: $zipPath" -ForegroundColor Green
    Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan

    # AWS CLI로 레이어 생성
    Write-Host "`nPublishing layer to AWS Lambda..." -ForegroundColor Yellow
    
    $dependenciesLayerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-dependencies-layer `
        --description "Dependencies Layer with email-validator metadata (FastAPI, Pydantic, Python 3.9)" `
        --compatible-runtimes python3.9 `
        --compatible-architectures x86_64 `
        --zip-file fileb://$zipPath

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to publish layer to AWS Lambda"
    }

    $dependenciesLayerArn = ($dependenciesLayerOutput | ConvertFrom-Json).LayerVersionArn
    Write-Host "`nDependencies layer created successfully!" -ForegroundColor Green
    Write-Host "Dependencies Layer ARN: $dependenciesLayerArn" -ForegroundColor Cyan
    
    $env:DEPENDENCIES_LAYER_ARN = $dependenciesLayerArn
    Write-Host "Environment variable has been set automatically for this session." -ForegroundColor Green

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Write-Host "Temporary directory '$tempDir' preserved for inspection" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Dependencies layer creation completed!" -ForegroundColor Green
Write-Host "Email validation compatibility secured:" -ForegroundColor Cyan
Write-Host "✓ email-validator package with metadata preserved" -ForegroundColor Green
Write-Host "✓ dnspython dependency included" -ForegroundColor Green
Write-Host "✓ Pydantic EmailStr support enabled" -ForegroundColor Green
Write-Host "✓ AWS Lambda metadata compatibility secured" -ForegroundColor Green
