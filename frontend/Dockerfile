FROM node:18-alpine

WORKDIR /app

# 먼저 package.json과 package-lock.json만 복사
COPY package*.json ./

# 의존성 설치 (react-scripts 포함)
RUN npm install

# 나머지 소스 코드 복사
COPY . .


# 포트 노출
EXPOSE 3000

# 애플리케이션 실행
CMD ["npm", "start"]