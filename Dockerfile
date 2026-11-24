FROM node:20-alpine AS build
WORKDIR /app

COPY apps/frontend-c2/package.json apps/frontend-c2/package-lock.json ./
RUN npm ci
COPY apps/frontend/adminPlugin.mjs /frontend/adminPlugin.mjs
COPY apps/frontend-c2/ ./
RUN npm run build

FROM nginx:1.27-alpine
ENV NGINX_ENVSUBST_FILTER=^GEOAI_
COPY apps/frontend/nginx.k8s.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
