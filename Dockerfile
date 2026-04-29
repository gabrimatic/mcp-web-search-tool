# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Multi-stage build for the MCP Web Search Tool.
# -----------------------------------------------------------------------------

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    ALLOW_KEYLESS=true
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./build
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
USER node
ENTRYPOINT ["node", "build/index.js"]
