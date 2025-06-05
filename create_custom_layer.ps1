# Custom Layer 생성 스크립트 (db, config, fast_api 모듈)
Write-Host "Creating custom layer with db, config, fast_api modules..." -ForegroundColor Green

# 임시 디렉토리 생성
$tempDir = "temp_custom_layer"
$pythonDir = "$tempDir\python"

try {
    # 기존 임시 디렉토리 정리
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
        Write-Host "Cleaned up existing temporary directory" -ForegroundColor Gray
    }

    # 디렉토리 생성
    New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    Write-Host "Created temporary directory: $pythonDir" -ForegroundColor Cyan

    # 커스텀 모듈 복사
    Write-Host "Copying custom modules..." -ForegroundColor Yellow
    $modules = @("db", "config", "fast_api")
    $copiedModules = @()
    
    foreach ($module in $modules) {
        if (Test-Path $module) {
            Copy-Item -Path $module -Destination "$pythonDir\$module" -Recurse -Force
            Write-Host "✓ Copied $module module" -ForegroundColor Green
            $copiedModules += $module
            
            # __init__.py 파일 생성/확인
            $initPath = "$pythonDir\$module\__init__.py"
            if (-not (Test-Path $initPath)) {
                New-Item -Path $initPath -ItemType File -Force | Out-Null
                Write-Host "  ✓ Created $module/__init__.py" -ForegroundColor Green
            } else {
                Write-Host "  ✓ $module/__init__.py already exists" -ForegroundColor Green
            }
        } else {
            Write-Host "⚠ Warning: $module directory not found in current path" -ForegroundColor Yellow
        }
    }

    if ($copiedModules.Count -eq 0) {
        throw "No custom modules found to include in the layer"
    }

    # 레이어 구조 확인
    Write-Host "`nCustom layer structure:" -ForegroundColor Yellow
    foreach ($module in $copiedModules) {
        Write-Host "- python/$module/" -ForegroundColor White
        $moduleFiles = Get-ChildItem -Path "$pythonDir\$module" -File
        foreach ($file in $moduleFiles) {
            Write-Host "  └── $($file.Name)" -ForegroundColor Gray
        }
    }

    # ZIP 파일 생성
    Write-Host "`nCreating zip file..." -ForegroundColor Yellow
    $zipPath = "custom-layer.zip"
    
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }

    # python 디렉토리를 포함하여 압축
    Compress-Archive -Path "$tempDir\python" -DestinationPath $zipPath -Force

    # 파일 크기 확인
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "Custom layer zip file created: $zipPath" -ForegroundColor Green
    Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan

    # AWS CLI로 레이어 생성
    Write-Host "`nPublishing custom layer to AWS Lambda..." -ForegroundColor Yellow
    
    $layerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-custom-layer `
        --description "Custom Layer with db, config, fast_api modules (Python 3.11 compatible)" `
        --compatible-runtimes python3.11 `
        --compatible-architectures x86_64 `
        --zip-file fileb://$zipPath

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to publish custom layer to AWS Lambda"
    }

    $layerArn = ($layerOutput | ConvertFrom-Json).LayerVersionArn
    Write-Host "`nCustom layer created successfully!" -ForegroundColor Green
    Write-Host "Custom Layer ARN: $layerArn" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Set this environment variable:" -ForegroundColor Yellow
    Write-Host "`$env:CUSTOM_LAYER_ARN = '$layerArn'" -ForegroundColor Yellow

    # 환경 변수 자동 설정
    $env:CUSTOM_LAYER_ARN = $layerArn
    Write-Host "Environment variable CUSTOM_LAYER_ARN set for this session." -ForegroundColor Green

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # 임시 디렉토리 정리
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
        Write-Host "Temporary directory cleaned up" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Custom layer creation completed!" -ForegroundColor Green
Write-Host "Included modules:" -ForegroundColor Cyan
foreach ($module in $copiedModules) {
    Write-Host "✓ $module" -ForegroundColor Green
}
