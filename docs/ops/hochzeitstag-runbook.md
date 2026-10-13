# Hochzeitstag-Runbook

Für die Person in Bereitschaft am Sa 17.10.2026. Alles per Handy/SSH machbar.
Server: netcup-VPS, App im Container `saru-vinith-wedding` hinter Traefik.
Compose-Datei: `docker-compose.yml` (Ordner auf dem Server: ______________).

| Wer | Erreichbar unter |
|---|---|
| Ansprechperson Technik | ______________ |
| Brautpaar | ______________ |
| Kennwort vom Empfang (Gäste) | liegt am Empfang aus |
| Admin-Zugang | `https://vsjourney.de/admin` (Kennwort im Passwortmanager) |

## 1. Schnellcheck (1 Minute)

1. Seite am Handy öffnen: `https://vsjourney.de`, dann `/gallery` und `/quiz`.
2. Am Rechner mit SSH-Zugang: `node scripts/smoke.mjs https://vsjourney.de`
   (mit `SMOKE_ADMIN_PASSWORD=...` zusätzlich Admin-Login). Alles ✓ = in Ordnung.
3. Lässt sich ein Foto hochladen? (Test-Foto, danach im Admin-Bereich löschen.)

## 2. Notfall-Schalter im Admin-Bereich (`/admin`, ohne Neustart)

| Schalter | Wirkung | Wann |
|---|---|---|
| **Foto-Upload** | Gäste können nicht hochladen, die Galerie bleibt sichtbar; Admin lädt weiter hoch | R2 macht Probleme, Missbrauch, Kosten steigen unerwartet |
| **Gästebuch** | Keine neuen Einträge | Spam oder Beleidigungen |
| **Erinnerungen** | Keine neuen Einträge | dito |
| **Wer-von-uns-Abstimmung** | Keine neuen Stimmen (Ergebnisse bleiben lesbar) | Auffälliges Abstimmverhalten |
| **Galerie-Sichtbarkeit: Kennwort** | Fotos nur nach Kennwort vom Empfang | Link ist an Fremde gelangt |
| **Memory-Rekord zurücksetzen** | Rekord aller Gäste wird gelöscht | unmöglicher Wert (z. B. 8 Züge · 00:04) |

Einzelne Einträge/Fotos löscht der Admin in den aufgeklappten Abschnitten.

## 3. Server (SSH, im Compose-Ordner)

```bash
docker compose -f docker-compose.yml ps                 # läuft der Container? Status "healthy"?
docker compose -f docker-compose.yml logs --tail 200 -f web
docker compose -f docker-compose.yml restart web        # Neustart (ca. 10 Sekunden)
df -h .                                                          # Platz auf der Platte
ls -lh data/backups | tail                                       # letzte Sicherungen
```

**Rollback auf eine ältere Version:**

```bash
IMAGE_TAG=<älterer-tag> docker compose -f docker-compose.yml pull
IMAGE_TAG=<älterer-tag> docker compose -f docker-compose.yml up -d
```

**Datenbank aus einer Sicherung wiederherstellen** (nur bei beschädigten Daten):

```bash
docker compose -f docker-compose.yml stop web
rm -f data/wedding.db-wal data/wedding.db-shm
cp data/backups/wedding-<Zeitstempel>.db data/wedding.db
docker compose -f docker-compose.yml start web
```

Die Sicherungen entstehen stündlich in `data/backups/`. Beim Wiederherstellen gehen
Einträge nach dem Zeitstempel verloren.

## 4. Symptom → Maßnahme

| Symptom | Wahrscheinliche Ursache | Maßnahme |
|---|---|---|
| Seite lädt nicht | Container gestoppt oder Traefik/DNS | `ps` und `logs` prüfen, `restart web`; `dig vsjourney.de` |
| Seite lädt, API-Fehler | Datenbank oder Start fehlgeschlagen | `logs --tail 200`: „FEHLER: Fehlende Pflicht-Umgebungsvariablen" = `.env.production` prüfen |
| Foto-Upload scheitert bei allen | R2-Token, CORS oder Domain | Foto-Upload **sperren**, `logs`; CORS-Regel und Token in Cloudflare prüfen |
| Upload scheitert nur bei einzelnen | große Datei (> 20 MB), HEIC, schwaches Netz | Gast soll es später im WLAN erneut versuchen; Meldung nennt den Grund |
| „Zu viele Anfragen" für viele Gäste | Rate-Limit wegen gemeinsamer WLAN-IP | `CLIENT_IP_HEADER` und Traefik-Header prüfen; Neustart setzt die Zähler zurück |
| Fotos verschwinden nach Löschen nicht | Cache-Purge fehlt | `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` prüfen |
| Alarm-Mail „Speicherplatz wird knapp" | Platte ≥ 85 % | `df -h`, alte Docker-Logs/Images (`docker system df`) |
| Alarm-Mail „Sicherung fehlgeschlagen" | Platte voll oder Datenbank beschädigt | `logs`, `df -h`; manuell `cp` der Datenbank sichern |
| Rekord im Memory unrealistisch | Skript hat einen Wert gesendet | Admin: „Memory-Rekord zurücksetzen" |

## 5. Plan B

Fällt die Seite komplett aus: QR-Code/Link zu einem geteilten Album
(Google Fotos/iCloud/Drive) bereithalten, Gäste dorthin schicken. Die Fotos
werden nach dem Fest zusammengeführt.

## 6. Nach der Hochzeit

1. Foto-Upload sperren, Galerie auf **Kennwort** stellen.
2. Alle Originale aus R2 exportieren (z. B. `rclone copy`), Stichproben prüfen.
3. Nach ca. 3 Monaten: Bucket leeren, Cache purgen, Bucket löschen, Daten sichern.
4. Offene Punkte in `TODO.md` (Videos, Off-Box-Backup).
