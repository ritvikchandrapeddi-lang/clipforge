FROM node:20-alpine AS builder

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install

COPY server ./server
COPY shared ./shared

RUN cd server && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared ./shared
COPY server/src/db/schema.sql ./server/src/db/schema.sql

EXPOSE 4001 4002

CMD ["node", "server/dist/index.js"]
