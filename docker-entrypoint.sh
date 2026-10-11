#!/bin/sh
set -e

# Laeuft als root beim Containerstart. Das gemountete ./data-Verzeichnis
# kann je nach Erzeugung auf dem Host anders als uid 1001 gehoeren - das
# wuerde Schreibzugriffe vom unprivilegierten "nextjs"-Nutzer fehlschlagen
# lassen. Rechte bei jedem Start korrigieren, dann zu "nextjs" wechseln.
mkdir -p ./data
chown -R nextjs:nodejs ./data

exec su-exec nextjs "$@"
