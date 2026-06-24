FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
COPY --from=netra-sdk . ./netra-sdk-js/

RUN npm install --install-links

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/db/db.json ./dist/db/db.json

ENV NODE_ENV=production

EXPOSE 8001

CMD ["node", "dist/index.js"]
