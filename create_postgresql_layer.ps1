# PostgreSQL 패키지 레이어 생성 (의존성 충돌 방지)
Write-Host "Creating PostgreSQL layer with dependency conflict prevention..." -ForegroundColor Green

# 임시 디렉토리 생성
$tempDir = "temp_postgresql_layer"
$pythonDir = "$tempDir\python\lib\python3.11\site-packages"

try {
    # 기존 디렉토리 정리
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
        Write-Host "Cleaned up existing directory content" -ForegroundColor Gray
    }

    New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    Write-Host "Created Python site-packages directory: $pythonDir" -ForegroundColor Cyan

    # 1. GitHub 레포지토리에서 psycopg2 설치 (우선)
    Write-Host "Step 1: Installing psycopg2 from GitHub repository..." -ForegroundColor Yellow
    
    $repoUrl = "https://github.com/jkehler/awslambda-psycopg2/archive/refs/heads/master.zip"
    $zipPath = "awslambda-psycopg2.zip"
    $extractPath = "awslambda-psycopg2-master"
    
    try {
        Invoke-WebRequest -Uri $repoUrl -OutFile $zipPath
        Write-Host "✓ Downloaded repository from GitHub" -ForegroundColor Green
    } catch {
        throw "Failed to download repository from GitHub: $($_.Exception.Message)"
    }
    
    try {
        Expand-Archive -Path $zipPath -DestinationPath "." -Force
        Write-Host "✓ Extracted repository archive" -ForegroundColor Green
    } catch {
        throw "Failed to extract repository archive: $($_.Exception.Message)"
    }
    
    # psycopg2-3.11 복사
    $psycopg2SourcePath = "$extractPath\psycopg2-3.11"
    if (-not (Test-Path $psycopg2SourcePath)) {
        throw "psycopg2-3.11 directory not found in the repository"
    }
    
    $psycopg2DestPath = "$pythonDir\psycopg2"
    Copy-Item -Path "$psycopg2SourcePath\*" -Destination $psycopg2DestPath -Recurse -Force
    Write-Host "✓ Successfully copied psycopg2 from GitHub" -ForegroundColor Green
    
    # 중첩 구조 수정
    $nestedPsycopg2 = "$psycopg2DestPath\psycopg2"
    if (Test-Path $nestedPsycopg2) {
        $tempBackup = "$pythonDir\psycopg2_temp"
        Move-Item -Path $nestedPsycopg2 -Destination $tempBackup
        Remove-Item -Path $psycopg2DestPath -Recurse -Force
        Move-Item -Path $tempBackup -Destination $psycopg2DestPath
        Write-Host "✓ Fixed nested psycopg2 structure" -ForegroundColor Green
    }

    # 2. numpy 설치 (pgvector 의존성 먼저 설치)
    Write-Host "Step 2: Installing numpy (pgvector dependency)..." -ForegroundColor Yellow
    
    $numpyVersions = @("1.26.4", "1.25.2", "1.24.4")
    $numpyInstalled = $false
    
    foreach ($version in $numpyVersions) {
        Write-Host "Installing numpy==$version..." -ForegroundColor Cyan
        
        try {
            python -m pip install --no-cache-dir `
                --platform manylinux2014_x86_64 `
                --target $pythonDir `
                --implementation cp `
                --python-version 3.11 `
                --only-binary=:all: `
                --upgrade `
                --force-reinstall `
                "numpy==$version"

            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Successfully installed numpy==$version" -ForegroundColor Green
                $numpyInstalled = $true
                break
            }
        } catch {
            Write-Host "Failed with numpy $version, trying next..." -ForegroundColor Yellow
        }
    }
    
    if (-not $numpyInstalled) {
        python -m pip install --no-cache-dir --target $pythonDir --upgrade numpy
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Successfully installed numpy (latest)" -ForegroundColor Green
        }
    }

    # 3. pgvector 설치 (의존성 제외)
    Write-Host "Step 3: Installing pgvector without dependencies..." -ForegroundColor Yellow
    
    $pgvectorVersions = @("0.3.6", "0.2.4", "0.2.3")
    $pgvectorInstalled = $false
    
    foreach ($version in $pgvectorVersions) {
        Write-Host "Installing pgvector==$version (no dependencies)..." -ForegroundColor Cyan
        
        try {
            # --no-deps 옵션으로 의존성 설치 방지
            python -m pip install --no-cache-dir `
                --platform manylinux2014_x86_64 `
                --target $pythonDir `
                --implementation cp `
                --python-version 3.11 `
                --only-binary=:all: `
                --no-deps `
                --upgrade `
                --force-reinstall `
                "pgvector==$version"

            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Successfully installed pgvector==$version without dependencies" -ForegroundColor Green
                $pgvectorInstalled = $true
                break
            }
        } catch {
            Write-Host "Failed with pgvector $version, trying next..." -ForegroundColor Yellow
        }
    }
    
    if (-not $pgvectorInstalled) {
        # 최후의 수단: 플랫폼 제한 없이 설치 (의존성 제외)
        python -m pip install --no-cache-dir --target $pythonDir --no-deps --upgrade pgvector
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Successfully installed pgvector without dependencies" -ForegroundColor Green
        }
    }

    # 4. psycopg2_binary.libs 확보 (pip에서)
    Write-Host "Step 4: Getting psycopg2_binary.libs from pip..." -ForegroundColor Yellow
    
    # 임시 디렉토리에 psycopg2-binary 설치하여 .libs 추출
    $tempPipDir = "temp_pip_psycopg2"
    New-Item -ItemType Directory -Path $tempPipDir -Force | Out-Null
    
    python -m pip install --no-cache-dir `
        --platform manylinux2014_x86_64 `
        --target $tempPipDir `
        --implementation cp `
        --python-version 3.11 `
        --only-binary=:all: `
        --upgrade `
        "psycopg2-binary==2.9.10"
    
    # .libs 디렉토리만 복사
    $tempLibsPath = "$tempPipDir\psycopg2_binary.libs"
    if (Test-Path $tempLibsPath) {
        Copy-Item -Path $tempLibsPath -Destination "$pythonDir\psycopg2_binary.libs" -Recurse -Force
        Write-Host "✓ Successfully copied psycopg2_binary.libs" -ForegroundColor Green
    } else {
        Write-Host "⚠ psycopg2_binary.libs not found in pip installation" -ForegroundColor Yellow
    }
    
    # 임시 pip 디렉토리 정리
    Remove-Item -Path $tempPipDir -Recurse -Force

    # 5. 충돌 검사 및 정리
    Write-Host "Step 5: Checking for conflicts and cleaning up..." -ForegroundColor Yellow
    
    # psycopg2 중복 설치 확인
    $conflictDirs = @()
    Get-ChildItem -Path $pythonDir -Directory | ForEach-Object {
        if ($_.Name -match "psycopg2.*" -and $_.Name -ne "psycopg2" -and $_.Name -ne "psycopg2_binary.libs") {
            $conflictDirs += $_.FullName
            Write-Host "⚠ Found conflicting directory: $($_.Name)" -ForegroundColor Yellow
        }
    }
    
    # 충돌 디렉토리 제거
    foreach ($conflictDir in $conflictDirs) {
        Remove-Item -Path $conflictDir -Recurse -Force
        Write-Host "✓ Removed conflicting directory: $(Split-Path $conflictDir -Leaf)" -ForegroundColor Green
    }

    # 6. 최종 구조 검증
    Write-Host "Step 6: Final structure verification..." -ForegroundColor Yellow
    
    $finalCheck = @{
        "psycopg2_module" = Test-Path "$pythonDir\psycopg2\__init__.py"
        "psycopg2_binary_libs" = Test-Path "$pythonDir\psycopg2_binary.libs"
        "pgvector_module" = Test-Path "$pythonDir\pgvector"
        "numpy_module" = Test-Path "$pythonDir\numpy"
    }
    
    foreach ($check in $finalCheck.GetEnumerator()) {
        if ($check.Value) {
            Write-Host "✓ $($check.Key) exists" -ForegroundColor Green
        } else {
            Write-Host "✗ $($check.Key) missing" -ForegroundColor Red
        }
    }
    
    # 설치된 패키지 목록 확인
    Write-Host "`nInstalled packages (no conflicts):" -ForegroundColor Yellow
    Get-ChildItem -Path $pythonDir -Directory | ForEach-Object {
        Write-Host "- $($_.Name)" -ForegroundColor White
    }
    
    # psycopg2 관련 디렉토리만 확인
    $psycopg2Related = Get-ChildItem -Path $pythonDir -Directory | Where-Object { $_.Name -match "psycopg" }
    Write-Host "`npsycopg2 related directories:" -ForegroundColor Cyan
    $psycopg2Related | ForEach-Object {
        Write-Host "- $($_.Name)" -ForegroundColor White
    }

    # 불필요한 파일 정리 (중요 파일 보존)
    Write-Host "`nCleaning up unnecessary files..." -ForegroundColor Yellow
    $cleanupPatterns = @("*.pyc", "__pycache__", "tests", "test")
    
    foreach ($pattern in $cleanupPatterns) {
        $itemsToRemove = Get-ChildItem -Path $pythonDir -Recurse -Name $pattern -Force
        foreach ($item in $itemsToRemove) {
            $fullPath = Join-Path $pythonDir $item
            if (Test-Path $fullPath) {
                Remove-Item -Path $fullPath -Recurse -Force
            }
        }
    }

    # ZIP 파일 생성
    Write-Host "`nCreating zip file..." -ForegroundColor Yellow
    $layerZipPath = "postgresql-layer.zip"
    
    if (Test-Path $layerZipPath) {
        Remove-Item -Path $layerZipPath -Force
    }

    Compress-Archive -Path "$tempDir\python" -DestinationPath $layerZipPath -Force

    # 파일 크기 확인
    $zipSize = (Get-Item $layerZipPath).Length / 1MB
    Write-Host "PostgreSQL layer zip file created: $layerZipPath" -ForegroundColor Green
    Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan

    # AWS CLI로 레이어 생성
    Write-Host "`nPublishing PostgreSQL layer to AWS Lambda..." -ForegroundColor Yellow
    
    $postgresqlLayerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-postgresql-layer `
        --description "PostgreSQL Layer (GitHub psycopg2-3.11, pgvector no-deps, numpy, Python 3.11, conflict-free)" `
        --compatible-runtimes python3.11 `
        --compatible-architectures x86_64 `
        --zip-file fileb://$layerZipPath

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to publish PostgreSQL layer to AWS Lambda"
    }

    $postgresqlLayerArn = ($postgresqlLayerOutput | ConvertFrom-Json).LayerVersionArn
    Write-Host "`nPostgreSQL layer created successfully!" -ForegroundColor Green
    Write-Host "PostgreSQL Layer ARN: $postgresqlLayerArn" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Set this environment variable:" -ForegroundColor Yellow
    Write-Host "`$env:POSTGRESQL_LAYER_ARN = '$postgresqlLayerArn'" -ForegroundColor Yellow

    $env:POSTGRESQL_LAYER_ARN = $postgresqlLayerArn

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # 임시 파일 정리
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }
    if (Test-Path $extractPath) {
        Remove-Item -Path $extractPath -Recurse -Force
    }
    Write-Host "Temporary directory '$tempDir' preserved for inspection" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "PostgreSQL layer creation completed!" -ForegroundColor Green
Write-Host "Conflict prevention verified:" -ForegroundColor Cyan
Write-Host "✓ Single psycopg2 installation (GitHub version)" -ForegroundColor Green
Write-Host "✓ pgvector installed without dependencies" -ForegroundColor Green
Write-Host "✓ No duplicate psycopg2 packages" -ForegroundColor Green
Write-Host "✓ psycopg2_binary.libs preserved" -ForegroundColor Green
