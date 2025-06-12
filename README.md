# 간단한 Lambda 레이어 테스트 가이드

이 프로젝트는 AWS Lambda에서 의존성 레이어를 차근차근 추가하고 테스트하는 방법을 보여줍니다.

## 파일 구조

- `simple_lambda.py` - 가장 기본적인 Lambda 함수
- `email_validator_test.py` - email-validator 의존성을 테스트하는 Lambda 함수
- `create_simple_layer.ps1` - 간단한 의존성 레이어를 생성하는 PowerShell 스크립트
- `deploy_simple_lambda.ps1` - Lambda 함수를 배포하는 PowerShell 스크립트

## 사용 방법



### 1. 간단한 의존성 레이어 생성

```powershell
.\create_simple_layer.ps1
```

이 스크립트는 다음을 수행합니다:
- Lambda 레이어 구조에 맞는 디렉토리 생성
- email-validator와 dnspython 패키지 설치
- 레이어 ZIP 파일 생성
- AWS Lambda에 레이어 게시
- 레이어 ARN을 환경 변수로 설정

### 2. Lambda 함수 배포

```powershell
.\deploy_simple_lambda.ps1
```

이 스크립트는 다음을 수행합니다:
- Lambda 함수 파일 압축
- 함수가 이미 존재하는지 확인
- 함수 생성 또는 업데이트
- 생성된 레이어 연결

### 3. Lambda 함수 테스트

```powershell
aws lambda invoke --function-name simple-email-validator-test --payload '{}' response.json
cat response.json
```

## 의존성 레이어 구조

Lambda 레이어는 다음과 같은 구조를 가져야 합니다:

```
python/
└── lib/
    └── python3.9/
        └── site-packages/
            ├── email_validator/
            ├── dns/
            └── ... (기타 패키지)
```

## 문제 해결

1. **ImportError 발생 시**:
   - 레이어 구조가 올바른지 확인
   - 필요한 모든 의존성 패키지가 포함되어 있는지 확인
   - Lambda 함수에 레이어가 제대로 연결되었는지 확인

2. **Lambda 함수 실행 시간 초과**:
   - Lambda 함수의 타임아웃 설정 확인
   - 무거운 의존성이 있는 경우 타임아웃 시간 증가

3. **레이어 크기 제한**:
   - Lambda 레이어는 압축 해제 시 250MB로 제한됨
   - 필요한 패키지만 포함하여 크기 최소화