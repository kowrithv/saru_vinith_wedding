#!/bin/sh
set -e

# Runs as root on container start. The mounted host directories (./data,
# ./public/uploads) can end up owned by root or another uid depending on how
# they were created on the server, which would make writes from the
# unprivileged "nextjs" user fail silently (e.g. admin settings not saving).
# Fix ownership here on every start, then drop to "nextjs" for the app itself.
mkdir -p ./data ./public/uploads
chown -R nextjs:nodejs ./data ./public/uploads

exec su-exec nextjs "$@"
