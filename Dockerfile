# Stage 1: build the Angular application
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve with nginx, as a non-root user (uid 101). The unprivileged image keeps the official
# image's entrypoint (templates rendered with envsubst) but moves the pid file and temp paths to /tmp
# and lets uid 101 write /etc/nginx/conf.d, where the template is rendered. Our port 5095 needs no root.
# The stable branch, not a pinned version: rebuilding with --pull picks up its fixes.
FROM nginxinc/nginx-unprivileged:stable-alpine

# Backend base URL, without a path (requests keep their /api prefix).
ENV API_UPSTREAM=http://backend:5096

# Root-owned files: readable by nginx, not writable.
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/security-headers-files.conf /etc/nginx/snippets/security-headers-files.conf
COPY --from=build /app/dist/PersonalFinancesFrontend/browser/ /usr/share/nginx/html/

EXPOSE 5095
