# ==========================
#  Etapa 1: Build de Angular
# ==========================
FROM node:22 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build -- --configuration=production

# ==========================
#  Etapa 2: Nginx sirviendo Angular + legacy
# ==========================
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# Angular build
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# ✅ Legacy public
COPY --from=build /app/legacy_public /usr/share/nginx/legacy_public

# ✅ Config para servir /public/*
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
