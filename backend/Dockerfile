FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nodeuser
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma
COPY --chown=nodeuser:nodejs package.json ./

ENV NODE_ENV=production PORT=4000 TZ=Asia/Seoul
USER nodeuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
