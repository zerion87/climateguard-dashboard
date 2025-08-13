#!/bin/sh
set -e

# Use envsubst to replace environment variables in the template
# The single quotes around '$API_HOST' tell envsubst to only substitute this specific variable
envsubst '$API_HOST' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
