FROM ollama/ollama:latest

# curl 설치
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# 시작 스크립트 생성
COPY start.sh /start.sh
RUN chmod +x /start.sh

# 시작 스크립트 실행
ENTRYPOINT ["/start.sh"]
