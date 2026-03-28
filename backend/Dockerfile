FROM node:20-slim

RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate

COPY start.sh .
RUN chmod +x start.sh

EXPOSE 4000
CMD ["./start.sh"]
