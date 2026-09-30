# One Dockerfile, one target per service: backend, frontend, simulator, test.

FROM node:22.12.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY simulator/package.json simulator/
RUN npm ci

# Express API on port 3000 with in-memory storage.
FROM node:22.12.0-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY simulator/package.json simulator/
RUN npm ci --omit=dev --workspace @fleet/backend && npm cache clean --force
COPY backend/src backend/src
USER node
EXPOSE 3000
CMD ["node", "backend/src/server.js"]

# Backend test suite (npm test).
FROM deps AS test
COPY backend backend
CMD ["npm", "test"]

FROM deps AS frontend-build
COPY frontend frontend
RUN npm run build:frontend

# Production dashboard served by nginx, which also proxies the API to the backend.
FROM nginx:1.27-alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80

# Interactive CLI simulator; it has no npm dependencies.
FROM node:22.12.0-alpine AS simulator
WORKDIR /app
COPY simulator/package.json simulator/
COPY simulator/src simulator/src
USER node
CMD ["node", "simulator/src/index.js"]
