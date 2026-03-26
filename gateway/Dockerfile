# ─────────────────────────────────────────────────────────
# Gateway — Production NGINX image
#
# WHY a custom image instead of nginx:alpine + volume mount?
# The CD pipeline detects changes by image digest. If the
# image tag is always "nginx:alpine", Docker sees no change
# and skips recreating the container — even when the config
# file on disk has been updated.
#
# By baking nginx.prod.conf INTO the image, any config
# change produces a new image digest. Docker Compose pull
# sees the new digest and recreates the container
# automatically.
#
# Build context is the repo root (context: . in CD),
# so paths are relative to the repo root.
# ─────────────────────────────────────────────────────────
FROM nginx:alpine

COPY gateway/nginx.prod.conf /etc/nginx/nginx.conf
