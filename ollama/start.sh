#!/bin/bash

echo "Ollama 서버를 시작합니다..."
# Ollama 서버 시작
ollama serve &

# 서버 시작 대기
echo "서버 시작을 기다리는 중..."
sleep 5

# ollama이 실행 중인지 확인
if pgrep -x "ollama" > /dev/null
then
    echo "Ollama 서버가 시작되었습니다. (포트 11434)"
    
    # Llama 2 모델 다운로드
    echo "Llama 2 모델을 다운로드합니다..."
    ollama pull llama2:7b
    
    echo "모델 다운로드가 완료되었습니다."
    
    # 컨테이너가 종료되지 않도록 계속 실행
    tail -f /dev/null
else
    echo "Ollama 서버 시작 실패! 로그를 확인하세요."
    exit 1
fi