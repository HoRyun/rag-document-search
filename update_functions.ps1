# Lambda 함수 코드 업데이트 스크립트 (lambda_code 폴더 기반)
Write-Host "Lambda 함수 코드 업데이트 시작..." -ForegroundColor Green
Write-Host "lambda_code 폴더에서 함수 파일 검색 중..." -ForegroundColor Cyan

# 함수 상태 확인 함수
function Wait-LambdaFunctionReady {
    param(
        [string]$FunctionName,
        [int]$MaxWaitTime = 300
    )
    
    Write-Host "Lambda 함수 '$FunctionName' 상태 확인 중..." -ForegroundColor Yellow
    
    $startTime = Get-Date
    do {
        try {
            $functionConfig = aws lambda get-function-configuration --function-name $FunctionName 2>&1 | ConvertFrom-Json
            $state = $functionConfig.State
            $lastUpdateStatus = $functionConfig.LastUpdateStatus
            
            Write-Host "  현재 상태: $state, 업데이트 상태: $lastUpdateStatus" -ForegroundColor Cyan
            
            if ($state -eq "Active" -and $lastUpdateStatus -eq "Successful") {
                Write-Host "  ✓ Lambda 함수가 준비되었습니다" -ForegroundColor Green
                return $true
            }
            
            if ($state -eq "Failed") {
                Write-Host "  ✗ Lambda 함수 상태 실패" -ForegroundColor Red
                return $false
            }
            
            Start-Sleep -Seconds 5
            $elapsed = (Get-Date) - $startTime
            
        } catch {
            Write-Host "  상태 확인 중 오류, 재시도 중..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            $elapsed = (Get-Date) - $startTime
        }
        
    } while ($elapsed.TotalSeconds -lt $MaxWaitTime)
    
    Write-Host "  ⚠ 대기 시간 초과" -ForegroundColor Yellow
    return $false
}

try {
    # 1. lambda_code 폴더 확인
    $lambdaCodePath = "lambda_code"
    if (-not (Test-Path $lambdaCodePath)) {
        throw "lambda_code 폴더가 존재하지 않습니다. 현재 디렉토리: $(Get-Location)"
    }
    
    Write-Host "✓ lambda_code 폴더 발견: $((Get-Item $lambdaCodePath).FullName)" -ForegroundColor Green
    
    # 2. lambda_code 폴더에서 함수 파일 검색
    Write-Host "`nlambda_code 폴더에서 함수 파일 검색 중..." -ForegroundColor Cyan
    
    $functionMapping = @{
        "lambda_auth.py" = @{name="auth"; function="ai-document-api-auth"}
        "lambda_users.py" = @{name="users"; function="ai-document-api-users"}
        "lambda_documents.py" = @{name="documents"; function="ai-document-api-documents"}
    }
    
    $availableFiles = @()
    foreach ($fileName in $functionMapping.Keys) {
        $filePath = Join-Path $lambdaCodePath $fileName
        if (Test-Path $filePath) {
            $fileInfo = $functionMapping[$fileName].Clone()
            $fileInfo.file = $filePath
            $fileInfo.fileName = $fileName
            Write-Host "✓ $fileName 파일 발견" -ForegroundColor Green
            $availableFiles += $fileInfo
        } else {
            Write-Host "⚠ $fileName 파일 없음 - 업데이트 건너뜀" -ForegroundColor Yellow
        }
    }
    
    # 추가 Python 파일 검색 (사용자 정의 함수)
    $additionalPyFiles = Get-ChildItem -Path $lambdaCodePath -Filter "*.py" | Where-Object { 
        $_.Name -notin $functionMapping.Keys 
    }
    
    if ($additionalPyFiles.Count -gt 0) {
        Write-Host "`n추가 Python 파일 발견:" -ForegroundColor Cyan
        foreach ($file in $additionalPyFiles) {
            Write-Host "  - $($file.Name)" -ForegroundColor White
        }
        
        $includeAdditional = Read-Host "추가 파일도 포함하시겠습니까? (y/N)"
        if ($includeAdditional -eq "y" -or $includeAdditional -eq "Y") {
            foreach ($file in $additionalPyFiles) {
                $customName = $file.BaseName -replace "lambda_", ""
                $customFunction = Read-Host "  $($file.Name)의 Lambda 함수명을 입력하세요 (기본: ai-document-api-$customName)"
                if ([string]::IsNullOrWhiteSpace($customFunction)) {
                    $customFunction = "ai-document-api-$customName"
                }
                
                $fileInfo = @{
                    name = $customName
                    function = $customFunction
                    file = $file.FullName
                    fileName = $file.Name
                }
                $availableFiles += $fileInfo
                Write-Host "✓ $($file.Name) 추가됨 -> $customFunction" -ForegroundColor Green
            }
        }
    }
    
    if ($availableFiles.Count -eq 0) {
        throw "lambda_code 폴더에서 업데이트할 함수 파일이 없습니다"
    }
    
    Write-Host "`n업데이트할 함수: $($availableFiles.Count)개" -ForegroundColor Magenta

    # 3. 지원 파일 및 폴더 확인
    Write-Host "`n지원 파일 및 폴더 확인 중..." -ForegroundColor Cyan
    
    $supportDirs = @("db", "fast_api", "config", "services")
    $supportFiles = @("requirements.txt", "config.py", "__init__.py")
    
    $includedSupport = @()
    foreach ($dir in $supportDirs) {
        $dirPath = Join-Path $lambdaCodePath $dir
        if (Test-Path $dirPath) {
            Write-Host "✓ $dir 폴더 발견" -ForegroundColor Green
            $includedSupport += $dirPath
        }
    }
    
    foreach ($file in $supportFiles) {
        $filePath = Join-Path $lambdaCodePath $file
        if (Test-Path $filePath) {
            Write-Host "✓ $file 파일 발견" -ForegroundColor Green
            $includedSupport += $filePath
        }
    }

    # 4. 함수 코드 패키징 (업데이트용)
    Write-Host "`nLambda 함수 코드 재패키징 중..." -ForegroundColor Cyan
    
    # 기존 패키지 디렉토리 정리
    if (Test-Path "package") {
        Remove-Item -Path "package" -Recurse -Force
        Write-Host "기존 패키지 디렉토리 정리 완료" -ForegroundColor Gray
    }
    
    foreach ($func in $availableFiles) {
        Write-Host "$($func.name) 함수 패키징 중..." -ForegroundColor Cyan
        
        # 패키지 디렉토리 생성
        $packageDir = "package\$($func.name)"
        New-Item -Path $packageDir -ItemType Directory -Force | Out-Null
        
        # 메인 함수 파일 복사
        Copy-Item -Path $func.file -Destination "$packageDir\$($func.fileName)" -Force
        Write-Host "  ✓ 메인 파일 복사: $($func.fileName)" -ForegroundColor White
        
        # 지원 파일 및 폴더 복사
        foreach ($supportItem in $includedSupport) {
            $itemName = Split-Path $supportItem -Leaf
            $destPath = Join-Path $packageDir $itemName
            
            if (Test-Path $supportItem -PathType Container) {
                # 폴더 복사
                Copy-Item -Path $supportItem -Destination $packageDir -Recurse -Force
                Write-Host "  ✓ 폴더 복사: $itemName" -ForegroundColor White
            } else {
                # 파일 복사
                Copy-Item -Path $supportItem -Destination $destPath -Force
                Write-Host "  ✓ 파일 복사: $itemName" -ForegroundColor White
            }
        }
        
        # ZIP 파일 생성
        $zipFile = "$($func.name)_function_update.zip"
        if (Test-Path $zipFile) {
            Remove-Item -Path $zipFile -Force
        }
        
        Compress-Archive -Path "$packageDir\*" -DestinationPath $zipFile -Force
        
        # ZIP 파일 크기 확인
        $zipSize = (Get-Item $zipFile).Length / 1MB
        Write-Host "✓ $($func.name) 함수 패키징 완료: $zipFile ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
        
        # Lambda 크기 제한 확인
        if ($zipSize -gt 50) {
            Write-Host "  ⚠ 경고: ZIP 파일이 50MB를 초과합니다. Layer 사용을 권장합니다." -ForegroundColor Yellow
        }
    }

    # 5. Lambda 함수 코드 업데이트
    Write-Host "`nLambda 함수 코드 업데이트 중..." -ForegroundColor Cyan
    
    foreach ($func in $availableFiles) {
        Write-Host "`n$($func.name) Lambda 함수 업데이트 중..." -ForegroundColor Yellow
        
        $zipFile = "$($func.name)_function_update.zip"
        
        # 함수 존재 여부 확인
        try {
            aws lambda get-function --function-name $func.function | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "⚠ 함수 '$($func.function)'가 존재하지 않습니다. 건너뜀." -ForegroundColor Yellow
                continue
            }
        } catch {
            Write-Host "⚠ 함수 '$($func.function)' 확인 실패. 건너뜀." -ForegroundColor Yellow
            continue
        }
        
        # 함수 코드 업데이트
        Write-Host "  코드 업데이트 실행 중..." -ForegroundColor Cyan
        aws lambda update-function-code `
            --function-name $func.function `
            --zip-file fileb://$zipFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $($func.name) 함수 코드 업데이트 시작됨" -ForegroundColor Green
            
            # 함수 준비 상태 대기
            if (Wait-LambdaFunctionReady -FunctionName $func.function) {
                Write-Host "✓ $($func.name) 함수 업데이트 완료" -ForegroundColor Green
                
                # 함수 정보 확인
                try {
                    $functionInfo = aws lambda get-function --function-name $func.function | ConvertFrom-Json
                    $lastModified = $functionInfo.Configuration.LastModified
                    $codeSize = $functionInfo.Configuration.CodeSize
                    $runtime = $functionInfo.Configuration.Runtime
                    
                    Write-Host "  - 런타임: $runtime" -ForegroundColor White
                    Write-Host "  - 마지막 수정: $lastModified" -ForegroundColor White
                    Write-Host "  - 코드 크기: $([math]::Round($codeSize / 1024, 2)) KB" -ForegroundColor White
                } catch {
                    Write-Host "  함수 정보 조회 실패" -ForegroundColor Yellow
                }
            } else {
                Write-Host "✗ $($func.name) 함수 업데이트 실패 또는 시간 초과" -ForegroundColor Red
            }
        } else {
            Write-Host "✗ $($func.name) 함수 코드 업데이트 실패" -ForegroundColor Red
        }
        
        # 각 함수 간 간격
        Start-Sleep -Seconds 2
    }

    # 6. 레이어 연결 확인 및 업데이트 (선택사항)
    Write-Host "`n레이어 연결 상태 확인..." -ForegroundColor Cyan
    
    $layerArns = @()
    if ($env:DEPENDENCIES_LAYER_ARN) { 
        $layerArns += $env:DEPENDENCIES_LAYER_ARN 
        Write-Host "✓ Dependencies Layer: $env:DEPENDENCIES_LAYER_ARN" -ForegroundColor Green
    }
    if ($env:POSTGRESQL_LAYER_ARN) { 
        $layerArns += $env:POSTGRESQL_LAYER_ARN 
        Write-Host "✓ PostgreSQL Layer: $env:POSTGRESQL_LAYER_ARN" -ForegroundColor Green
    }
    if ($env:POSTGRESQL_ONLY_LAYER_ARN) { 
        $layerArns += $env:POSTGRESQL_ONLY_LAYER_ARN 
        Write-Host "✓ PostgreSQL Only Layer: $env:POSTGRESQL_ONLY_LAYER_ARN" -ForegroundColor Green
    }
    if ($env:CUSTOM_LAYER_ARN) { 
        $layerArns += $env:CUSTOM_LAYER_ARN 
        Write-Host "✓ Custom Layer: $env:CUSTOM_LAYER_ARN" -ForegroundColor Green
    }
    
    if ($layerArns.Count -gt 0) {
        Write-Host "사용 가능한 레이어: $($layerArns.Count)개" -ForegroundColor Green
        
        $updateLayers = Read-Host "레이어를 업데이트하시겠습니까? (y/N)"
        if ($updateLayers -eq "y" -or $updateLayers -eq "Y") {
            foreach ($func in $availableFiles) {
                Write-Host "$($func.name) 함수에 레이어 연결 중..." -ForegroundColor Yellow
                
                aws lambda update-function-configuration `
                    --function-name $func.function `
                    --layers $layerArns
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✓ $($func.name) 함수 레이어 업데이트 완료" -ForegroundColor Green
                    
                    # 레이어 연결 후 함수 준비 대기
                    Wait-LambdaFunctionReady -FunctionName $func.function | Out-Null
                } else {
                    Write-Host "✗ $($func.name) 함수 레이어 업데이트 실패" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "⚠ 사용 가능한 레이어 ARN이 없습니다" -ForegroundColor Yellow
        Write-Host "다음 환경 변수를 설정하세요:" -ForegroundColor Cyan
        Write-Host "  - DEPENDENCIES_LAYER_ARN" -ForegroundColor Gray
        Write-Host "  - POSTGRESQL_LAYER_ARN 또는 POSTGRESQL_ONLY_LAYER_ARN" -ForegroundColor Gray
        Write-Host "  - CUSTOM_LAYER_ARN (선택사항)" -ForegroundColor Gray
    }

    # 7. 업데이트 결과 요약
    Write-Host "`n📊 업데이트 결과 요약:" -ForegroundColor Magenta
    Write-Host "=" * 60 -ForegroundColor Gray
    
    foreach ($func in $availableFiles) {
        try {
            $functionConfig = aws lambda get-function-configuration --function-name $func.function | ConvertFrom-Json
            $state = $functionConfig.State
            $runtime = $functionConfig.Runtime
            $lastModified = $functionConfig.LastModified
            $codeSize = $functionConfig.CodeSize
            $layers = $functionConfig.Layers
            
            Write-Host "✓ $($func.name) ($($func.fileName))" -ForegroundColor Green
            Write-Host "  함수명: $($func.function)" -ForegroundColor White
            Write-Host "  상태: $state | 런타임: $runtime" -ForegroundColor White
            Write-Host "  크기: $([math]::Round($codeSize / 1024, 2)) KB | 수정: $lastModified" -ForegroundColor White
            Write-Host "  레이어: $($layers.Count)개 연결됨" -ForegroundColor White
            Write-Host ""
        } catch {
            Write-Host "✗ $($func.name): 상태 확인 실패" -ForegroundColor Red
        }
    }

} catch {
    Write-Host "`n❌ 오류가 발생했습니다: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "현재 작업 디렉토리: $(Get-Location)" -ForegroundColor Gray
    Write-Host "lambda_code 폴더 구조를 확인하세요." -ForegroundColor Gray
    exit 1
} finally {
    # 정리 작업
    Write-Host "`n🧹 정리 작업 중..." -ForegroundColor Gray
    
    # 임시 ZIP 파일 정리
    Get-ChildItem -Filter "*_function_update.zip" | ForEach-Object {
        Remove-Item -Path $_.Name -Force
        Write-Host "정리됨: $($_.Name)" -ForegroundColor Gray
    }
    
    # 패키지 디렉토리 정리
    if (Test-Path "package") {
        Remove-Item -Path "package" -Recurse -Force
        Write-Host "패키지 디렉토리 정리 완료" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "🎉 Lambda 함수 업데이트 완료!" -ForegroundColor Green
Write-Host "업데이트된 함수: $($availableFiles.Count)개" -ForegroundColor Cyan
Write-Host "소스 폴더: lambda_code" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 다음 단계:" -ForegroundColor Yellow
Write-Host "1. AWS 콘솔에서 함수 동작 확인" -ForegroundColor White
Write-Host "2. API Gateway 테스트 실행" -ForegroundColor White
Write-Host "3. CloudWatch 로그 모니터링" -ForegroundColor White
Write-Host "4. PostgreSQL 연결 및 pgvector 기능 테스트" -ForegroundColor White
