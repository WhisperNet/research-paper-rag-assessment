FROM oven/bun:1.1 AS build

WORKDIR /app/frontend-service

COPY frontend-service/package.json frontend-service/bun.lock ./
RUN bun install --ci

COPY frontend-service/ ./
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/frontend-service/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf

# Nginx serves on port 80 by default
EXPOSE 80

# Use default nginx entrypoint/cmd


