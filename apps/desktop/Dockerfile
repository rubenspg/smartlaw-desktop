# Build stage
FROM node:22-alpine as build
WORKDIR /app

# Copy lock and package files
COPY package.json package-lock.json ./
COPY apps/desktop/package.json ./apps/desktop/
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies for all packages
RUN npm install

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/
COPY apps/desktop/ ./apps/desktop/

# Build static files
WORKDIR /app/apps/desktop
# Set build environment variables (defaults to remote Proxmox API)
ARG VITE_API_URL=https://smartlaw-api.rubenspg.com
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Serve stage
FROM nginx:stable-alpine
COPY --from=build /app/apps/desktop/dist /usr/share/nginx/html
COPY apps/desktop/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
