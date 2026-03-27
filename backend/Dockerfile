FROM node:20-slim

RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
