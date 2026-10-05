# syntax=docker/dockerfile:1

# ---- build stage: compile the static bundle ----
FROM node:22-alpine AS builder

RUN corepack enable
WORKDIR /app

# Install deps first so this layer is cached until the lockfile changes
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# Baked in at build time (Vite inlines import.meta.env). Default "/api" is
# same-origin: the reverse proxy routes it to the svc.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm build

# ---- runtime stage: static files served by unprivileged nginx ----
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
