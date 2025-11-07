FROM oven/bun:1.1

WORKDIR /app/backend-service

# Install dependencies first (leveraging Docker layer cache)
COPY backend-service/package.json backend-service/bun.lock ./
RUN bun install --ci

# Copy source code
COPY backend-service/ ./

ENV NODE_ENV=production
# Default port per env.ts
ENV API_PORT=8000
EXPOSE 8000

# Run the server using Bun (executes TypeScript directly)
CMD ["bun", "run", "src/server.ts"]


