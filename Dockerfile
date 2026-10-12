# ---- build ----
FROM node:22.22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime ----
FROM nginx:1.29-alpine
# Templates em /etc/nginx/templates passam por envsubst na inicialização da imagem oficial.
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV CLARA_API_UPSTREAM=http://api:8000
EXPOSE 8080
