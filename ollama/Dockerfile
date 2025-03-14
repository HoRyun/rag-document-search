FROM ollama/ollama:latest

# 시작 스크립트 생성
COPY start.sh /start.sh
RUN chmod +x /start.sh

# 시작 스크립트 실행
ENTRYPOINT ["/start.sh"]
