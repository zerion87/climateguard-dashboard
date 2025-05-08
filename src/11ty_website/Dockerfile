# Basis-Image mit Node.js
FROM node:20-alpine AS builder

# Arbeitsverzeichnis
WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm install

# Quellcode kopieren
COPY . .

# Eleventy-Build
RUN npx @11ty/eleventy

# --- zweiter Schritt: reines Webserver-Image ---
FROM nginx:alpine

# Statische Site in nginx Webroot kopieren
COPY --from=builder /app/_site /usr/share/nginx/html

# Optionale nginx-Konfiguration (z. B. für saubere URLs)
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
