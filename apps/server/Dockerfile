FROM node:22-alpine
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --omit=dev

# Copy source (tsx runs TypeScript directly — no compile step needed)
COPY tsconfig.base.json ./
COPY apps/server/src ./apps/server/src
COPY apps/server/tsconfig.json ./apps/server/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/

EXPOSE 3001
CMD ["npx", "tsx", "apps/server/src/index.ts"]
