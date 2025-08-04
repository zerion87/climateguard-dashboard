# Basis-Image: Nginx mit Alpine
FROM nginx:alpine

# Entferne Standard-Nginx-Inhalte
RUN rm -rf /usr/share/nginx/html/*

# Kopiere die Website-Dateien in das HTML-Verzeichnis von Nginx
COPY src/nuernbergklima/src/ /usr/share/nginx/html/

# Setze sichere Datei- und Verzeichnisrechte
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# Exponiere Port 80
EXPOSE 80
EXPOSE 443

# Starte den Server
CMD ["nginx", "-g", "daemon off;"]
