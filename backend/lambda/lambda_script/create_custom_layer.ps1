# Custom Layer 생성 스크립트 (구조 검사용 파일 보존)
Write-Host "Creating custom layer with db, config, fast_api modules from backend directory..." -ForegroundColor Green

# 임시 디렉토리 생성
$tempDir = "temp_custom_layer"
$pythonDir = "$tempDir\python"

try {
    # 스크립트 실행 시에만 기존 임시 디렉토리 정리
    if (Test-Path $tempDir) {
        Write-Host "Cleaning up existing temporary directory from previous run..." -ForegroundColor Yellow
        Remove-Item -Path $tempDir -Recurse -Force
        Write-Host "✓ Cleaned up existing temporary directory" -ForegroundColor Gray
    }

    # 디렉토리 생성
    New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    Write-Host "Created temporary directory: $pythonDir" -ForegroundColor Cyan

    # backend 디렉토리 확인
    $backendPath = "backend"
    if (-not (Test-Path $backendPath)) {
        throw "Backend directory not found at: $backendPath"
    }
    Write-Host "✓ Found backend directory: $backendPath" -ForegroundColor Green

    # 필요한 추가 패키지 설치
    Write-Host "Installing additional required packages..." -ForegroundColor Yellow
    python -m pip install --no-cache-dir --target $pythonDir email-validator
    Write-Host "✓ Installed email-validator package" -ForegroundColor Green
    
    # 커스텀 모듈 복사 (backend 디렉토리에서)
    Write-Host "Copying custom modules from backend directory..." -ForegroundColor Yellow
    $modules = @("db", "config", "fast_api")
    $copiedModules = @()
    
    foreach ($module in $modules) {
        $modulePath = "$backendPath\$module"
        if (Test-Path $modulePath) {
            Copy-Item -Path $modulePath -Destination "$pythonDir\$module" -Recurse -Force
            Write-Host "✓ Copied $module module from: $modulePath" -ForegroundColor Green
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
            Write-Host "⚠ Warning: $module directory not found in backend path: $modulePath" -ForegroundColor Yellow
        }
    }

    if ($copiedModules.Count -eq 0) {
        throw "No custom modules found to include in the layer"
    }

    # 레이어 구조 확인 및 문서화
    Write-Host "`nCustom layer structure:" -ForegroundColor Yellow
    $structureReport = @()
    $structureReport += "Custom Layer Structure Report"
    $structureReport += "Generated: $(Get-Date)"
    $structureReport += "Source: backend directory"
    $structureReport += ""
    $structureReport += "Layer Structure:"
    $structureReport += "$tempDir\"
    $structureReport += "└── python\"
    
    foreach ($module in $copiedModules) {
        Write-Host "- python/$module/" -ForegroundColor White
        $structureReport += "    ├── $module\"
        
        $moduleFiles = Get-ChildItem -Path "$pythonDir\$module" -File
        foreach ($file in $moduleFiles) {
            Write-Host "  └── $($file.Name)" -ForegroundColor Gray
            $structureReport += "    │   ├── $($file.Name)"
        }
        
        # 하위 디렉토리도 확인
        $subDirs = Get-ChildItem -Path "$pythonDir\$module" -Directory
        foreach ($subDir in $subDirs) {
            $structureReport += "    │   └── $($subDir.Name)\"
        }
    }

    # 구조 보고서 파일 생성
    $reportPath = "$tempDir\layer_structure_report.txt"
    $structureReport | Out-File -FilePath $reportPath -Encoding utf8
    Write-Host "`n✓ Layer structure report saved: $reportPath" -ForegroundColor Green

    # 검사용 README 파일 생성
    $readmePath = "$tempDir\README.md"
    $readmeContent = @"
# Custom Layer Structure

This directory contains the generated Lambda Layer structure for inspection.

## Generated Files
- **python/**: Lambda Layer content directory
- **layer_structure_report.txt**: Detailed structure report
- **README.md**: This file

## Modules Included
$($copiedModules | ForEach-Object { "- $_" } | Out-String)

## Usage
This structure will be packaged into a ZIP file and uploaded to AWS Lambda as a layer.

## Inspection
You can examine the contents of the python/ directory to verify:
1. All required modules are present
2. __init__.py files are created
3. File structure is correct for Lambda Layer

## Cleanup
This directory will be automatically cleaned up on the next script run.
To manually clean up, delete the entire '$tempDir' directory.

Generated: $(Get-Date)
"@
    $readmeContent | Out-File -FilePath $readmePath -Encoding utf8
    Write-Host "✓ README file created: $readmePath" -ForegroundColor Green

    # backend 디렉토리 내용 확인 (디버깅용)
    Write-Host "`nBackend directory contents:" -ForegroundColor Yellow
    Get-ChildItem -Path $backendPath -Directory | ForEach-Object {
        Write-Host "- $($_.Name)" -ForegroundColor White
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

    # ZIP 파일 내용 검증
    Write-Host "`nZIP file contents verification:" -ForegroundColor Yellow
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $zipEntries = $zip.Entries | Select-Object -First 10
    foreach ($entry in $zipEntries) {
        Write-Host "  - $($entry.FullName)" -ForegroundColor Gray
    }
    if ($zip.Entries.Count -gt 10) {
        Write-Host "  ... and $($zip.Entries.Count - 10) more files" -ForegroundColor Gray
    }
    $zip.Dispose()

    # AWS CLI로 레이어 생성
    Write-Host "`nPublishing custom layer to AWS Lambda..." -ForegroundColor Yellow
    
    $layerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-custom-layer `
        --description "Custom Layer with db, config, fast_api modules from backend (Python 3.9 compatible)" `
        --compatible-runtimes python3.9 `
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
    # 임시 디렉토리는 보존 (검사용)
    # Remove-Item -Path $tempDir -Recurse -Force  # 이 줄을 주석 처리
    Write-Host "`nTemporary directory preserved for inspection: $tempDir" -ForegroundColor Cyan
    Write-Host "Contents:" -ForegroundColor Yellow
    if (Test-Path $tempDir) {
        Get-ChildItem -Path $tempDir | ForEach-Object {
            Write-Host "  - $($_.Name)" -ForegroundColor White
        }
    }
}

Write-Host ""
Write-Host "Custom layer creation completed!" -ForegroundColor Green
Write-Host "Source location: backend directory" -ForegroundColor Cyan
Write-Host "Included modules:" -ForegroundColor Cyan
foreach ($module in $copiedModules) {
    Write-Host "✓ $module (from backend/$module)" -ForegroundColor Green
}

Write-Host ""
Write-Host "📁 Inspection Files Created:" -ForegroundColor Magenta
Write-Host "  - $tempDir\python\ (Layer content)" -ForegroundColor White
Write-Host "  - $tempDir\layer_structure_report.txt (Detailed report)" -ForegroundColor White
Write-Host "  - $tempDir\README.md (Documentation)" -ForegroundColor White
Write-Host ""
Write-Host "💡 To inspect the layer structure:" -ForegroundColor Yellow
Write-Host "   explorer $tempDir" -ForegroundColor Gray
Write-Host "   Get-ChildItem -Path $tempDir -Recurse" -ForegroundColor Gray
Write-Host ""
Write-Host "🗑️  To manually clean up:" -ForegroundColor Yellow
Write-Host "   Remove-Item -Path $tempDir -Recurse -Force" -ForegroundColor Gray
