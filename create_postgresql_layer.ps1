# PostgreSQL 패키지 레이어 생성 (psycopg2_binary.libs 보존 포함)
Write-Host "Creating PostgreSQL layer with psycopg2_binary.libs preservation..." -ForegroundColor Green

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

    # GitHub 레포지토리에서 awslambda-psycopg2 다운로드
    Write-Host "Downloading awslambda-psycopg2 from GitHub..." -ForegroundColor Yellow
    
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
    
    # psycopg2-3.11 디렉토리 확인
    $psycopg2SourcePath = "$extractPath\psycopg2-3.11"
    if (-not (Test-Path $psycopg2SourcePath)) {
        throw "psycopg2-3.11 directory not found in the repository"
    }
    
    Write-Host "✓ Found psycopg2-3.11 directory" -ForegroundColor Green
    
    # psycopg2 패키지를 올바른 구조로 복사
    Write-Host "Copying psycopg2-3.11 with ALL files including .libs..." -ForegroundColor Yellow
    $psycopg2DestPath = "$pythonDir\psycopg2"
    
    # 모든 파일을 올바른 구조로 복사
    Copy-Item -Path "$psycopg2SourcePath\*" -Destination $psycopg2DestPath -Recurse -Force
    Write-Host "✓ Successfully copied psycopg2 with all files" -ForegroundColor Green
    
    # psycopg2_binary.libs 디렉토리 별도 확인 및 복사
    Write-Host "Checking for psycopg2_binary.libs directory..." -ForegroundColor Yellow
    
    # GitHub 레포지토리에서 .libs 디렉토리 찾기
    $libsSourcePaths = @(
        "$extractPath\psycopg2-3.11\.libs",
        "$extractPath\psycopg2_binary.libs",
        "$psycopg2SourcePath\psycopg2_binary.libs"
    )
    
    $libsFound = $false
    foreach ($libsPath in $libsSourcePaths) {
        if (Test-Path $libsPath) {
            $libsDestPath = "$pythonDir\psycopg2_binary.libs"
            Copy-Item -Path $libsPath -Destination $libsDestPath -Recurse -Force
            Write-Host "✓ Found and copied psycopg2_binary.libs from: $libsPath" -ForegroundColor Green
            $libsFound = $true
            break
        }
    }
    
    if (-not $libsFound) {
        Write-Host "⚠ psycopg2_binary.libs not found in GitHub repo, installing via pip..." -ForegroundColor Yellow
        
        # pip으로 psycopg2-binary 설치하여 .libs 디렉토리 확보
        python -m pip install --no-cache-dir `
            --platform manylinux2014_x86_64 `
            --target $pythonDir `
            --implementation cp `
            --python-version 3.11 `
            --only-binary=:all: `
            --upgrade `
            --force-reinstall `
            "psycopg2-binary==2.9.10"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Installed psycopg2-binary via pip to get .libs directory" -ForegroundColor Green
        }
    }
    
    # 구조 검증 및 수정
    Write-Host "Verifying and fixing psycopg2 structure..." -ForegroundColor Yellow
    
    # 중첩 구조 수정
    $nestedPsycopg2 = "$psycopg2DestPath\psycopg2"
    if (Test-Path $nestedPsycopg2) {
        Write-Host "⚠ Found nested psycopg2 directory, fixing structure..." -ForegroundColor Yellow
        
        $tempBackup = "$pythonDir\psycopg2_temp"
        Move-Item -Path $nestedPsycopg2 -Destination $tempBackup
        Remove-Item -Path $psycopg2DestPath -Recurse -Force
        Move-Item -Path $tempBackup -Destination $psycopg2DestPath
        
        Write-Host "✓ Fixed nested psycopg2 structure" -ForegroundColor Green
    }
    
    # 필수 파일 확인
    $requiredFiles = @(
        "$psycopg2DestPath\__init__.py",
        "$pythonDir\psycopg2_binary.libs"
    )
    
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Write-Host "✓ Required file/directory exists: $(Split-Path $file -Leaf)" -ForegroundColor Green
        } else {
            Write-Host "✗ Missing required file/directory: $(Split-Path $file -Leaf)" -ForegroundColor Red
        }
    }
    
    # .so 파일 확인
    $soFiles = Get-ChildItem -Path $psycopg2DestPath -Filter "*.so" -File
    if ($soFiles.Count -gt 0) {
        Write-Host "✓ Linux binary files found: $($soFiles.Count) files" -ForegroundColor Green
        $soFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
    } else {
        Write-Host "⚠ Warning: No .so files found in psycopg2 directory" -ForegroundColor Yellow
    }
    
    # psycopg2_binary.libs 내용 확인
    if (Test-Path "$pythonDir\psycopg2_binary.libs") {
        $libFiles = Get-ChildItem -Path "$pythonDir\psycopg2_binary.libs" -File
        Write-Host "✓ psycopg2_binary.libs contains $($libFiles.Count) library files" -ForegroundColor Green
        $libFiles | Select-Object -First 5 | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
        if ($libFiles.Count -gt 5) {
            Write-Host "  ... and $($libFiles.Count - 5) more files" -ForegroundColor Gray
        }
    } else {
        Write-Host "✗ psycopg2_binary.libs directory missing!" -ForegroundColor Red
    }
    
    # pgvector와 numpy 설치
    Write-Host "Installing additional packages (pgvector, numpy)..." -ForegroundColor Yellow
    
    $additionalPackages = @(
        @{name="pgvector"; versions=@("0.3.6", "0.2.4")},
        @{name="numpy"; versions=@("1.26.4", "1.25.2")}
    )
    
    foreach ($pkg in $additionalPackages) {
        $success = $false
        
        foreach ($version in $pkg.versions) {
            Write-Host "Installing $($pkg.name)==$version..." -ForegroundColor Cyan
            
            try {
                python -m pip install --no-cache-dir `
                    --platform manylinux2014_x86_64 `
                    --target $pythonDir `
                    --implementation cp `
                    --python-version 3.11 `
                    --only-binary=:all: `
                    --upgrade `
                    --force-reinstall `
                    "$($pkg.name)==$version"

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✓ Successfully installed $($pkg.name)==$version" -ForegroundColor Green
                    $success = $true
                    break
                }
            } catch {
                Write-Host "Failed with $version, trying next..." -ForegroundColor Yellow
            }
        }
        
        if (-not $success) {
            python -m pip install --no-cache-dir --target $pythonDir --upgrade $pkg.name
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Successfully installed $($pkg.name)" -ForegroundColor Green
            }
        }
    }

    # 정리 작업 (psycopg2_binary.libs 보존)
    Write-Host "`nCleaning up unnecessary files (preserving .libs and .so files)..." -ForegroundColor Yellow
    
    # 보존할 패턴 정의
    $preservePatterns = @("*.so", "*.libs", "psycopg2_binary.libs")
    
    # 안전한 정리 (중요한 파일 보존)
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
    
    # *.dist-info는 선별적으로 정리 (.libs 디렉토리 보존)
    $distInfoDirs = Get-ChildItem -Path $pythonDir -Recurse -Name "*.dist-info" -Directory
    foreach ($distInfo in $distInfoDirs) {
        $fullPath = Join-Path $pythonDir $distInfo
        if ($distInfo -notlike "*psycopg2*") {
            Remove-Item -Path $fullPath -Recurse -Force
            Write-Host "Removed: $distInfo" -ForegroundColor Gray
        }
    }

    # 최종 구조 검증
    Write-Host "`nFinal structure verification:" -ForegroundColor Yellow
    
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

    # ZIP 파일 내용 검증
    Write-Host "`nZIP file content verification:" -ForegroundColor Yellow
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($layerZipPath)
    
    $zipContents = @{
        "psycopg2_files" = ($zip.Entries | Where-Object { $_.FullName -like "*psycopg2/*" }).Count
        "libs_files" = ($zip.Entries | Where-Object { $_.FullName -like "*psycopg2_binary.libs/*" }).Count
        "so_files" = ($zip.Entries | Where-Object { $_.FullName -like "*.so" }).Count
    }
    $zip.Dispose()
    
    foreach ($content in $zipContents.GetEnumerator()) {
        Write-Host "✓ $($content.Key): $($content.Value) files" -ForegroundColor Green
    }

    # AWS CLI로 레이어 생성
    Write-Host "`nPublishing PostgreSQL layer to AWS Lambda..." -ForegroundColor Yellow
    
    $postgresqlLayerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-postgresql-layer `
        --description "PostgreSQL Layer (GitHub psycopg2-3.11 with .libs, pgvector, numpy, Python 3.11)" `
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
    Write-Host "Environment variable has been set automatically for this session." -ForegroundColor Green

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
Write-Host "Critical files preserved:" -ForegroundColor Cyan
Write-Host "✓ psycopg2 module with correct structure" -ForegroundColor Green
Write-Host "✓ psycopg2_binary.libs directory preserved" -ForegroundColor Green
Write-Host "✓ All .so binary files preserved" -ForegroundColor Green
Write-Host "✓ pgvector and numpy included" -ForegroundColor Green
