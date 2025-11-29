FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/verifications.db

EXPOSE 3000

CMD ["node", "dist/main"]
