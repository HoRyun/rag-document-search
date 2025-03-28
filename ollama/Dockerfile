FROM ollama/ollama:latest

# 필요한 기본 도구 설치
RUN apt-get update -y && apt-get install -y curl procps

# 실행 스크립트 복사 및 권한 설정
COPY ./start.sh /start.sh
RUN chmod +x /start.sh

# 볼륨 설정 (모델 데이터를 유지하기 위함)
VOLUME /root/.ollama

# 포트 노출
EXPOSE 11434

# 기본 ENTRYPOINT 초기화 및 시작 스크립트 실행
ENTRYPOINT []
CMD ["/bin/bash", "/start.sh"]
