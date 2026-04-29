# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Multi-stage build for the MCP Web Search Tool.
# -----------------------------------------------------------------------------

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
# --ignore-scripts skips the `prepare` hook so tsc isn't invoked before
# sources have been copied. We build explicitly below.
RUN npm ci --ignore-scripts --no-audit --no-fund \
    || npm install --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    ALLOW_KEYLESS=true
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/build ./build
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    || npm install --omit=dev --ignore-scripts --no-audit --no-fund
USER node
ENTRYPOINT ["node", "build/index.js"]
