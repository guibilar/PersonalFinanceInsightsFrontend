# Stage 1: build the Angular application
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:1.27-alpine

# Backend base URL, without a path (requests keep their /api prefix).
ENV API_UPSTREAM=http://backend:5096

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/PersonalFinancesFrontend/browser/ /usr/share/nginx/html/

EXPOSE 5095
