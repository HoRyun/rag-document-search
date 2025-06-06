# Lambda 함수 코드 업데이트 스크립트
Write-Host "Lambda 함수 코드 업데이트 시작..." -ForegroundColor Green

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
    # 1. 업데이트할 함수 코드 파일 확인
    Write-Host "업데이트할 함수 코드 파일 확인 중..." -ForegroundColor Cyan
    
    $functionFiles = @(
        @{name="auth"; file="lambda_auth.py"; function="ai-document-api-auth"},
        @{name="users"; file="lambda_users.py"; function="ai-document-api-users"},
        @{name="documents"; file="lambda_documents.py"; function="ai-document-api-documents"}
    )
    
    $availableFiles = @()
    foreach ($func in $functionFiles) {
        if (Test-Path $func.file) {
            Write-Host "✓ $($func.file) 파일 존재" -ForegroundColor Green
            $availableFiles += $func
        } else {
            Write-Host "⚠ $($func.file) 파일 없음 - 업데이트 건너뜀" -ForegroundColor Yellow
        }
    }
    
    if ($availableFiles.Count -eq 0) {
        throw "업데이트할 함수 파일이 없습니다"
    }

    # 2. 함수 코드 패키징 (업데이트용)
    Write-Host "`nLambda 함수 코드 재패키징 중..." -ForegroundColor Cyan
    
    # 기존 패키지 디렉토리 정리
    if (Test-Path "package") {
        Remove-Item -Path "package" -Recurse -Force
        Write-Host "기존 패키지 디렉토리 정리 완료" -ForegroundColor Gray
    }
    
    foreach ($func in $availableFiles) {
        Write-Host "$($func.name) 함수 패키징 중..." -ForegroundColor Cyan
        
        # 패키지 디렉토리 생성
        New-Item -Path "package\$($func.name)" -ItemType Directory -Force | Out-Null
        
        # 함수 파일 복사
        Copy-Item -Path $func.file -Destination "package\$($func.name)\" -Force
        
        # ZIP 파일 생성
        $zipFile = "$($func.name)_function_update.zip"
        if (Test-Path $zipFile) {
            Remove-Item -Path $zipFile -Force
        }
        
        Compress-Archive -Path "package\$($func.name)\*" -DestinationPath $zipFile -Force
        Write-Host "✓ $($func.name) 함수 패키징 완료: $zipFile" -ForegroundColor Green
    }

    # 3. Lambda 함수 코드 업데이트
    Write-Host "`nLambda 함수 코드 업데이트 중..." -ForegroundColor Cyan
    
    foreach ($func in $availableFiles) {
        Write-Host "`n$($func.name) Lambda 함수 업데이트 중..." -ForegroundColor Yellow
        
        $zipFile = "$($func.name)_function_update.zip"
        
        # 함수 코드 업데이트
        aws lambda update-function-code `
            --function-name $func.function `
            --zip-file fileb://$zipFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $($func.name) 함수 코드 업데이트 시작됨" -ForegroundColor Green
            
            # 함수 준비 상태 대기
            if (Wait-LambdaFunctionReady -FunctionName $func.function) {
                Write-Host "✓ $($func.name) 함수 업데이트 완료" -ForegroundColor Green
                
                # 함수 정보 확인
                $functionInfo = aws lambda get-function --function-name $func.function | ConvertFrom-Json
                $lastModified = $functionInfo.Configuration.LastModified
                $codeSize = $functionInfo.Configuration.CodeSize
                
                Write-Host "  - 마지막 수정: $lastModified" -ForegroundColor White
                Write-Host "  - 코드 크기: $([math]::Round($codeSize / 1024, 2)) KB" -ForegroundColor White
            } else {
                Write-Host "✗ $($func.name) 함수 업데이트 실패 또는 시간 초과" -ForegroundColor Red
            }
        } else {
            Write-Host "✗ $($func.name) 함수 코드 업데이트 실패" -ForegroundColor Red
        }
        
        # 각 함수 간 간격
        Start-Sleep -Seconds 2
    }

    # 4. 레이어 연결 확인 및 업데이트 (선택사항)
    Write-Host "`n레이어 연결 상태 확인..." -ForegroundColor Cyan
    
    $layerArns = @()
    if ($env:DEPENDENCIES_LAYER_ARN) { $layerArns += $env:DEPENDENCIES_LAYER_ARN }
    if ($env:POSTGRESQL_LAYER_ARN) { $layerArns += $env:POSTGRESQL_LAYER_ARN }
    if ($env:CUSTOM_LAYER_ARN) { $layerArns += $env:CUSTOM_LAYER_ARN }
    
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
                } else {
                    Write-Host "✗ $($func.name) 함수 레이어 업데이트 실패" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "⚠ 사용 가능한 레이어 ARN이 없습니다" -ForegroundColor Yellow
        Write-Host "다음 환경 변수를 설정하세요:" -ForegroundColor Cyan
        Write-Host "  - DEPENDENCIES_LAYER_ARN" -ForegroundColor Gray
        Write-Host "  - POSTGRESQL_LAYER_ARN" -ForegroundColor Gray
        Write-Host "  - CUSTOM_LAYER_ARN" -ForegroundColor Gray
    }

    # 5. 업데이트 결과 요약
    Write-Host "`n📊 업데이트 결과 요약:" -ForegroundColor Magenta
    foreach ($func in $availableFiles) {
        try {
            $functionConfig = aws lambda get-function-configuration --function-name $func.function | ConvertFrom-Json
            $state = $functionConfig.State
            $runtime = $functionConfig.Runtime
            $lastModified = $functionConfig.LastModified
            
            Write-Host "✓ $($func.name): $state ($runtime) - $lastModified" -ForegroundColor Green
        } catch {
            Write-Host "✗ $($func.name): 상태 확인 실패" -ForegroundColor Red
        }
    }

} catch {
    Write-Host "`n❌ 오류가 발생했습니다: $($_.Exception.Message)" -ForegroundColor Red
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
Write-Host ""
Write-Host "💡 다음 단계:" -ForegroundColor Yellow
Write-Host "1. AWS 콘솔에서 함수 동작 확인" -ForegroundColor White
Write-Host "2. API Gateway 테스트 실행" -ForegroundColor White
Write-Host "3. CloudWatch 로그 모니터링" -ForegroundColor White
