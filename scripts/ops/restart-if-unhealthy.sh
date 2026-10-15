#!/bin/sh
# Startet den Container neu, wenn sein Healthcheck "unhealthy" meldet.
#
# Docker startet einen Container bei `restart: unless-stopped` nur neu, wenn der
# Prozess ENDET - ein hängender Prozess bleibt "running (unhealthy)" und antwortet
# nie wieder. Dieses Skript schließt die Lücke ohne zusätzlichen Container und
# ohne Zugriff auf den Docker-Socket aus einem Container heraus.
#
# Einrichtung (auf dem Server, jede Minute):
#   * * * * * /pfad/zu/restart-if-unhealthy.sh >> /var/log/saru-autoheal.log 2>&1
#
# Aufruf:  restart-if-unhealthy.sh [Containername]   (Standard: saru-vinith-wedding)
NAME="${1:-saru-vinith-wedding}"

if ! status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$NAME" 2>/dev/null)"; then
  echo "[autoheal] $(date '+%Y-%m-%dT%H:%M:%S') Container $NAME nicht gefunden"
  exit 0
fi

if [ "$status" = "unhealthy" ]; then
  echo "[autoheal] $(date '+%Y-%m-%dT%H:%M:%S') $NAME ist unhealthy, starte neu"
  docker restart "$NAME"
fi
