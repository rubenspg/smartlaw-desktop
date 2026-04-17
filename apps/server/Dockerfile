# Base stage
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY . .

# Build stage
FROM base AS build
RUN npm install
RUN npm run build -w packages/shared
RUN npm run build -w apps/server

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/src ./packages/shared/src

# Install production dependencies only
RUN npm install --omit=dev

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
