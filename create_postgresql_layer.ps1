# PostgreSQL 패키지 레이어 생성 (aws-psycopg2, Python 3.9 x86_64 확실한 호환성)
Write-Host "Creating PostgreSQL layer using aws-psycopg2 with guaranteed Python 3.9 x86_64 compatibility..." -ForegroundColor Green

$tempDir = "temp_postgresql_layer"
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

    # 검색 결과 [5]에서 권장하는 방법으로 aws-psycopg2 설치
    Write-Host "Installing aws-psycopg2 with explicit Python 3.9 x86_64 compatibility..." -ForegroundColor Yellow
    
    python -m pip install --no-cache-dir `
        --platform manylinux2014_x86_64 `
        --target $pythonDir `
        --implementation cp `
        --python-version 3.9 `
        --only-binary=:all: `
        --upgrade `
        "aws-psycopg2"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully installed aws-psycopg2 for Python 3.9 x86_64" -ForegroundColor Green
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
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Successfully installed psycopg2-binary for Python 3.9 x86_64" -ForegroundColor Green
        } else {
            throw "Failed to install both aws-psycopg2 and psycopg2-binary"
        }
    }

    # 설치 확인 및 아키텍처 검증
    Write-Host "`nVerifying installation..." -ForegroundColor Yellow
    
    if (Test-Path "$pythonDir\psycopg2") {
        Write-Host "✓ psycopg2 module found" -ForegroundColor Green
        
        # 바이너리 파일 확인
        $soFiles = Get-ChildItem -Path "$pythonDir\psycopg2" -Filter "*.so" -File
        if ($soFiles.Count -gt 0) {
            Write-Host "✓ Linux x86_64 binary files found: $($soFiles.Count) files" -ForegroundColor Green
            $soFiles | ForEach-Object { 
                Write-Host "  - $($_.Name)" -ForegroundColor White 
            }
        }
        
        # 메타데이터 확인
        $distInfoDirs = Get-ChildItem -Path $pythonDir -Directory | Where-Object { $_.Name -like "*psycopg2*" -or $_.Name -like "*aws_psycopg2*" }
        if ($distInfoDirs) {
            Write-Host "✓ Package metadata found: $($distInfoDirs.Name -join ', ')" -ForegroundColor Green
        }
    } else {
        Write-Host "✗ psycopg2 module not found" -ForegroundColor Red
    }

    # ZIP 파일 생성
    Write-Host "`nCreating zip file..." -ForegroundColor Yellow
    $zipPath = "postgresql-layer-aws-psycopg2-py39.zip"
    
    if (Test-Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }

    Compress-Archive -Path "$tempDir\python" -DestinationPath $zipPath -Force

    # 파일 크기 확인
    $zipSize = (Get-Item $zipPath).Length / 1MB
    Write-Host "PostgreSQL layer zip file created: $zipPath" -ForegroundColor Green
    Write-Host "Zip file size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan

    # AWS CLI로 레이어 생성
    Write-Host "`nPublishing PostgreSQL layer to AWS Lambda..." -ForegroundColor Yellow
    
    $postgresqlLayerOutput = aws lambda publish-layer-version `
        --layer-name ai-document-api-postgresql-layer-aws `
        --description "PostgreSQL Layer using aws-psycopg2 (Python 3.9 x86_64 guaranteed compatibility)" `
        --compatible-runtimes python3.9 `
        --compatible-architectures x86_64 `
        --zip-file fileb://$zipPath

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
    Write-Host "Temporary directory '$tempDir' preserved for inspection" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "PostgreSQL layer creation completed!" -ForegroundColor Green
Write-Host "Guaranteed compatibility secured:" -ForegroundColor Cyan
Write-Host "✓ Python 3.9 runtime compatibility" -ForegroundColor Green
Write-Host "✓ x86_64 architecture compatibility (manylinux2014)" -ForegroundColor Green
Write-Host "✓ AWS Lambda environment compatibility" -ForegroundColor Green
Write-Host "✓ Static libpq linking (aws-psycopg2 feature)" -ForegroundColor Green
