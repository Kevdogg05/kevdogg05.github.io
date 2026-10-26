# Front door for OpenAvatarStudio: one port for the dashboard and the API,
# optional password, and automatic HTTPS when OAS_DOMAIN is set.
FROM caddy:2.10-alpine
COPY entrypoint.sh /usr/local/bin/oas-proxy
RUN chmod +x /usr/local/bin/oas-proxy
ENTRYPOINT ["oas-proxy"]
