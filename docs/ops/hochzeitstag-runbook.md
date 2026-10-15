# Hochzeitstag-Runbook

Für die Person in Bereitschaft am Sa 17.10.2026. Alles per Handy/SSH machbar.
Server: netcup-VPS, App im Container `saru-vinith-wedding` auf `127.0.0.1:3000`,
TLS und Domain über den Caddy auf dem Host (`/etc/caddy/Caddyfile`).
Compose-Datei: `docker-compose.yml` (Ordner auf dem Server: ______________).
In diesem Ordner liegen auch `.env` (Compose: `IMAGE_TAG`) und `.env.production` (App).

| Wer | Erreichbar unter |
|---|---|
| Ansprechperson Technik | ______________ |
| Brautpaar | ______________ |
| Kennwort vom Empfang (Gäste) | liegt am Empfang aus; QR-Code mit `https://vsjourney.de/gallery#k=<Kennwort>` (Erzeugung: README „Gäste-Zugang") |
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
| **Erinnerungs-Fotos** | Erinnerungen nur noch mit Text; das Fotofeld verschwindet, Galerie und Foto-Upload bleiben | Anhängen von Fotos macht Probleme oder wird missbraucht |
| **Gästebuch** | Keine neuen Einträge | Spam oder Beleidigungen |
| **Erinnerungen** | Keine neuen Einträge | dito |
| **Wer-von-uns-Abstimmung** | Keine neuen Stimmen (Ergebnisse bleiben lesbar) | Auffälliges Abstimmverhalten |
| **Galerie-Sichtbarkeit** | **Kennwort** (Standard): Fotos nur mit QR-Code/Kennwort; **Öffentlich**: jeder mit dem Link sieht die Fotos | auf Kennwort lassen; ist der Link an Fremde gelangt: zusätzlich das Kennwort wechseln (§3) |
| **Gemeldete Ergebnisse** (Memory) | einzelne Ergebnisse entfernen, der Rekord fällt auf das nächstbeste zurück | unmöglicher Wert (z. B. 8 Züge · 00:04) |
| **Memory-Rekord zurücksetzen** | alle gemeldeten Ergebnisse werden gelöscht | nach Testspielen vor der Feier |

Einzelne Einträge/Fotos löscht der Admin in den aufgeklappten Abschnitten.

## 3. Server (SSH, im Compose-Ordner)

```bash
docker compose -f docker-compose.yml ps                 # läuft der Container? Status "healthy"?
docker compose -f docker-compose.yml logs --tail 200 -f web
docker compose -f docker-compose.yml restart web        # Neustart (ca. 10 Sekunden)
df -h .                                                          # Platz auf der Platte
ls -lh data/backups | tail                                       # letzte Sicherungen
```

**Achtung:** `restart` liest `.env.production` **nicht** neu. Nach jeder Änderung
an den App-Werten (z. B. `GUEST_PASSWORD`, `CLIENT_IP_HEADER`, SMTP, R2):

```bash
docker compose -f docker-compose.yml up -d --force-recreate web
```

**Gäste-Kennwort wechseln:** neuen Wert in `.env.production` setzen, dann
`up -d --force-recreate web` (siehe oben). Alle bisherigen Sitzungen und
gedruckten QR-Codes werden ungültig: neuen QR-Code erzeugen (README „Gäste-Zugang"),
der Empfang gibt das neue Kennwort aus.

**Rollback auf eine ältere Version:**

In der `.env` `IMAGE_TAG=<älterer-tag>` eintragen, dann:

```bash
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d
```

**Datenbank aus einer Sicherung wiederherstellen** (nur bei beschädigten Daten):

```bash
docker compose -f docker-compose.yml stop web
sudo rm -f data/wedding.db-wal data/wedding.db-shm     # sudo: ./data gehört uid 1001
sudo cp data/backups/wedding-<Zeitstempel>.db data/wedding.db
docker compose -f docker-compose.yml start web
```

Die Sicherungen entstehen stündlich in `data/backups/`. Beim Wiederherstellen gehen
Einträge nach dem Zeitstempel verloren.

## 4. Symptom → Maßnahme

| Symptom | Wahrscheinliche Ursache | Maßnahme |
|---|---|---|
| Seite lädt nicht | Container gestoppt oder Caddy/DNS | `ps` und `logs` prüfen, `restart web`; `curl -sI http://127.0.0.1:3000/api/health` (App) und `systemctl status caddy` (Proxy); `dig vsjourney.de` |
| Seite lädt, API-Fehler | Datenbank oder Start fehlgeschlagen | `logs --tail 200`: „FEHLER: Fehlende Pflicht-Umgebungsvariablen" = `.env.production` prüfen, dann `up -d --force-recreate web` |
| Foto-Upload scheitert bei allen | R2-Token, CORS oder Domain | Foto-Upload **sperren**, `logs`; CORS-Regel und Token in Cloudflare prüfen |
| Erinnerung mit Foto scheitert, ohne Foto geht es | Foto-Pfad (R2, Ticket, Größe) | Schalter **Erinnerungs-Fotos** sperren (Text bleibt möglich), `logs` ansehen; scheitert auch der Galerie-Upload, wie die Zeile darüber |
| Upload scheitert nur bei einzelnen | große Datei (> 20 MB), HEIC, schwaches Netz | Gast soll es später im WLAN erneut versuchen; Meldung nennt den Grund |
| „Zu viele Anfragen" für viele Gäste | Rate-Limit wegen gemeinsamer WLAN-IP | `CLIENT_IP_HEADER` und den `X-Forwarded-For`-Header von Caddy prüfen, dann `up -d --force-recreate web` (setzt die Zähler zurück; `restart` liest die Werte nicht neu) |
| Fotos verschwinden nach Löschen nicht | Cache-Purge fehlt | `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` prüfen |
| Gäste sehen plötzlich wieder das Kennwortfeld; der QR-Code „ist nicht mehr gültig" | Kennwort geändert (Sitzungen und QR-Codes ungültig) oder Cookies gelöscht | Kennwort am Empfang nennen; bei geändertem Kennwort neuen QR-Code erzeugen |
| Alarm-Mail „Speicherplatz wird knapp" | Platte ≥ 85 % | `df -h`, alte Docker-Logs/Images (`docker system df`) |
| Alarm-Mail „Sicherung fehlgeschlagen" | Platte voll oder Datenbank beschädigt | `logs`, `df -h`; manuell `cp` der Datenbank sichern |
| Alarm-Mail „Sicherung hängt" | vorige Sicherung läuft nach einer Stunde noch (Platte blockiert/sehr langsam) | `df -h`, `logs`; hilft nichts: `restart web` (Reste `*.tmp` räumt der nächste Lauf) |
| Sehr viele unmögliche Memory-Ergebnisse (Skript-Flut) | Ein Skript meldet massenhaft Bestwerte | Einzelnes Entfernen lohnt nicht: „Memory-Rekord zurücksetzen". Ehrliche Ergebnisse gehen erst verloren, wenn über 100.000 gefälschte da sind (Stunden Dauerfeuer) |
| Rekord im Memory unrealistisch | Skript hat einen Wert gesendet | Admin: in „Gemeldete Ergebnisse" das einzelne Ergebnis **entfernen** (der Rekord fällt auf das nächstbeste zurück); „Memory-Rekord zurücksetzen" löscht alle |

## 5. Plan B

Fällt die Seite komplett aus: QR-Code/Link zu einem geteilten Album
(Google Fotos/iCloud/Drive) bereithalten, Gäste dorthin schicken. Die Fotos
werden nach dem Fest zusammengeführt.

## 6. Nach der Hochzeit

1. Foto-Upload sperren, Galerie auf **Kennwort** stellen.
2. Alle Originale aus R2 exportieren (z. B. `rclone copy`), Stichproben prüfen.
3. Nach ca. 3 Monaten: Bucket leeren, Cache purgen, Bucket löschen, Daten sichern.
4. Offene Punkte in `TODO.md` (Videos, Off-Box-Backup).

## 7. Off-Box-Kopie und Uptime-Monitor (Vorbereitung, sobald Ziel/Anbieter feststehen)

Die stündlichen Sicherungen liegen auf derselben Platte wie die Datenbank und
schützen nicht vor einem Plattenausfall. Beides hier läuft **außerhalb der App**
und braucht keine Code-Änderung.

**Off-Box-Kopie** (Beispiel mit `rsync` über SSH auf einen zweiten Server; ein
privater Bucket mit `rclone copy` geht genauso):

```bash
# crontab -e auf dem Server – 5 Minuten nach der stündlichen App-Sicherung:
5 * * * * rsync -a --exclude '*.tmp*' -e "ssh -i ~/.ssh/backup_key" <compose-ordner>/data/backups/ <benutzer>@<zielhost>:<pfad>/wedding-backups/
```

- Ohne `--delete`: das Ziel behält auch Sicherungen, die die App schon rotiert hat.
- `--exclude '*.tmp*'`: die App schreibt eine Sicherung zuerst als `*.tmp`; eine
  halb geschriebene Datei soll nicht ins Ziel kopiert werden.
- **Nicht** den öffentlichen Foto-Bucket (die Foto-Domain) als Ziel nehmen:
  alles darin ist öffentlich abrufbar. Ein Bucket nur für Sicherungen, privat.
- Einmal probeweise ausführen und im Ziel nachsehen, dass `wedding-*.db`
  angekommen ist.

**Neustart bei hängendem Prozess** (`restart: unless-stopped` startet nur neu, wenn der
Prozess endet; ein hängender bleibt "running (unhealthy)"):

```bash
# crontab -e auf dem Server, jede Minute:
* * * * * <repo>/scripts/ops/restart-if-unhealthy.sh >> /var/log/saru-autoheal.log 2>&1
```

Das Skript prüft den Healthcheck des Containers `saru-vinith-wedding` und startet
ihn neu, sobald er `unhealthy` meldet. Es braucht nur `docker` auf dem Host, keinen
zusätzlichen Container.

**Uptime-Monitor** (z. B. UptimeRobot oder Better Stack, beide mit kostenlosem Tarif):

- Prüfung: HTTPS-GET auf `https://vsjourney.de/api/health`, erwartet Status 200
  (Antwort `{"ok":true}`).
- Intervall 5 Minuten, Benachrichtigung per E-Mail/Push an mindestens zwei Personen.
- Der Monitor fängt auch eine Neustart-Schleife, bei der die App selbst keine
  Alarm-Mail mehr losbekommt.
