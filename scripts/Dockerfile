FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY vite.config.js index.html ./
COPY public ./public
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build && npx tsc --outDir dist-api && printf '{"type":"commonjs"}' > dist-api/package.json

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-api ./dist-api
COPY prisma ./prisma

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist-api/server.js"]