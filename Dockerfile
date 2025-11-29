FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/
COPY capture.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

RUN chmod -R 644 /usr/share/nginx/html/*.html && \
    chmod -R 755 /usr/share/nginx/html/css /usr/share/nginx/html/js && \
    find /usr/share/nginx/html/css -type f -exec chmod 644 {} \; && \
    find /usr/share/nginx/html/js -type f -exec chmod 644 {} \;

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
