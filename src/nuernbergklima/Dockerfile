# Basis-Image: Nginx mit Alpine
FROM nginx:alpine

# Entferne Standard-Nginx-Inhalte
RUN rm -rf /usr/share/nginx/html/*

# Kopiere die Website-Dateien in das HTML-Verzeichnis von Nginx
COPY src/nuernbergklima/src/ /usr/share/nginx/html/

# Setze sichere Datei- und Verzeichnisrechte
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# Setup for Nginx template
RUN mkdir -p /etc/nginx/templates
COPY src/nuernbergklima/nginx.conf.template /etc/nginx/templates/
COPY src/nuernbergklima/start-nginx.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start-nginx.sh

# Exponiere Port 80
EXPOSE 80
EXPOSE 443

# Starte den Server
CMD ["/usr/local/bin/start-nginx.sh"]
