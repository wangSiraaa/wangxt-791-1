FROM node:18-alpine AS builder

RUN apk add --no-cache python3 py3-setuptools make g++

WORKDIR /app

COPY package*.json ./

RUN npm install --build-from-source

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY --from=builder /app/node_modules ./node_modules

COPY package*.json ./
COPY . .

RUN mkdir -p ./data && chmod 755 ./data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]
