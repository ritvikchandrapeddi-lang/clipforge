FROM node:20-alpine AS builder

WORKDIR /app

COPY workers/package*.json ./workers/
RUN cd workers && npm install

COPY workers ./workers
COPY shared ./shared

RUN cd workers && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Install system ffmpeg as well for maximum reliability in container
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production

COPY workers/package*.json ./workers/
RUN cd workers && npm install --omit=dev

COPY --from=builder /app/workers/dist ./workers/dist
COPY --from=builder /app/shared ./shared

CMD ["node", "workers/dist/index.js"]
