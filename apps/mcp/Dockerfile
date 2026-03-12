FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/mcp/package.json apps/mcp/package.json
COPY packages/core/package.json packages/core/package.json

RUN npm ci --include=dev

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/apps/mcp/package.json ./apps/mcp/package.json
COPY --from=deps /app/packages/core/package.json ./packages/core/package.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/mcp ./apps/mcp
COPY packages/core ./packages/core

EXPOSE 4000

CMD ["npx", "tsx", "apps/mcp/src/index.ts"]
