# .env 파일에서 환경 변수 설정
$envContent = Get-Content .\.env

foreach ($line in $envContent) {
    if ($line -match "^\s*#" -or $line -match "^\s*$") {
        # 주석이나 빈 줄 무시
        continue
    }
    
    if ($line -match "^([^=]+)=(.*)$") {
        $key = $matches[1]
        $value = $matches[2]
        
        # 환경 변수 설정
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
        Write-Host "환경 변수 설정: $key"
    }
}

Write-Host "환경 변수 설정 완료. deploy_all.ps1을 실행하세요."