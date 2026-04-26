FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Limita uso de memoria do Node durante install e build (evita OOM em VPS pequena).
ENV NODE_OPTIONS="--max-old-space-size=1024"

COPY package.json package-lock.json ./
# Flags reduzem trabalho de rede/log e o paralelismo de download (menos pico de RAM).
RUN npm ci --prefer-offline --no-audit --no-fund --loglevel=error --maxsockets=4

COPY . .
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
