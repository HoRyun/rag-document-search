#!/bin/sh
set -e

# Ollama 서버 백그라운드로 시작
ollama serve &

# 서버가 시작될 때까지 잠시 대기
sleep 5

# llama2 모델 다운로드
echo "Downloading llama2 model..."
curl -X POST http://localhost:11434/api/pull -d '{"name": "llama2"}'

# 포그라운드 프로세스 유지 (컨테이너가 종료되지 않도록)
wait