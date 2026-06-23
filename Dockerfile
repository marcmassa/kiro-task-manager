# ── FEAT-011 / R24: Server Mode ─────────────────────────────────────────────
# Task Manager — Servidor web + API + Workspace Git
# Uso: docker build -t task-manager . && docker run -p 3000:3000 -v task-data:/data task-manager

FROM oven/bun:1 AS base

# Install Git (necesario para clone, push, pull, status, etc.)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# App source
COPY . .

# Build frontend
RUN bun run build:css && bun run build

# Volumen persistente para DB + workspaces clonados
VOLUME ["/data"]

ENV WORKSPACES_DIR=/data/workspaces
ENV DATA_DIR=/data
ENV PORT=3000
ENV GIT_BINARY=git

EXPOSE 3000

CMD ["bun", "run", "start"]
