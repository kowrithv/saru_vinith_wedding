# Saruga & Vinith – Hochzeitswebsite

Website zur Hochzeit von Saruga und Vinith am **Samstag, 17. Oktober 2026**:
Geschichte, Hochzeitsinfos, Galerie mit Foto-Upload, Quiz, Memory-Spiel,
„Wer von uns?“-Abstimmung, Erinnerungen und Gästebuch – dazu ein
Admin-Bereich für das Brautpaar.

## Seiten

| Pfad | Inhalt |
|---|---|
| `/` | Startseite mit Countdown und Übersicht |
| `/story` | Unsere Geschichte |
| `/info` | Hochzeitsinfos (Ort, Zeit, Ablauf, Karte) |
| `/gallery` | Fotogalerie, Upload für Gäste, Kategorien, offizielle Fotos |
| `/quiz` | Hochzeitsquiz und „Wer von uns?“-Abstimmung |
| `/memory-spiel` | Liebes-Memory mit Bestzeit |
| `/memories` | Erinnerungen der Gäste |
| `/guestbook` | Gästebuch |
| `/admin` | Admin-Bereich (nicht in der Navigation verlinkt) |

Unbekannte URLs leiten auf die Startseite weiter (`src/app/not-found.tsx`).
Die Seite ist per `robots.txt` und Meta-Tag für Suchmaschinen gesperrt.

## Stack

Next.js 16 (App Router, `output: 'standalone'`), React 19, TypeScript,
Tailwind CSS v4, framer-motion, Leaflet. Daten liegen in **SQLite**
(`better-sqlite3`, WAL), Fotos in **Cloudflare R2**. Tests mit Vitest und
React Testing Library.

> Next.js 16 weicht in Teilen von älteren Versionen ab. Die passende
> Dokumentation liegt unter `node_modules/next/dist/docs/`.

## Schnellstart

Voraussetzung: **Node.js ≥ 24**.

```bash
npm ci
cp .env.example .env.local   # Werte eintragen, siehe unten
npm run dev                  # http://localhost:3000
```

Der Server **bricht beim Start ab**, wenn eine Pflicht-Variable fehlt
(`src/instrumentation.ts`). Für lokales Arbeiten genügen beliebige
Platzhalter; echte R2-Zugangsdaten braucht man nur, um den Foto-Upload
wirklich auszuprobieren.

## Umgebungsvariablen

| Variable | Pflicht | Zweck |
|---|---|---|
| `ADMIN_PASSWORD` | ja | Kennwort für `/admin` |
| `UPLOAD_PASSWORD_EMPFANG` | ja | Gäste-Kennwort („vom Empfang“) für Uploads und die Galerie im Kennwort-Modus |
| `R2_ACCOUNT_ID` | ja | Cloudflare-Konto |
| `R2_ACCESS_KEY_ID` | ja | R2-API-Token (Object Read & Write, nur für den Bucket) |
| `R2_SECRET_ACCESS_KEY` | ja | zum Token gehörendes Secret |
| `R2_BUCKET_NAME` | ja | Name des Buckets |
| `R2_PUBLIC_BASE_URL` | ja | öffentliche Auslieferungs-URL, z. B. `https://fotos.<domain>` |
| `CLIENT_IP_HEADER` | nein | Quelle der Client-IP für die Rate-Limiter: Standard `x-forwarded-for` (Traefik setzt ihn). `cf-connecting-ip` nur, wenn die Website hinter dem Cloudflare-Proxy läuft; ohne Proxy kann jeder den Header selbst setzen |
| `R2_JURISDICTION` | nein | `eu`, wenn der Bucket mit EU-Jurisdiktion angelegt wurde: der S3-Endpoint lautet dann `<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` (fest, nachträglich nicht änderbar) |
| `ADMIN_SECRET` | nein | Signierschlüssel für Cookies; wird sonst zufällig erzeugt und in der DB gespeichert |
| `CLOUDFLARE_API_TOKEN` | nein | Recht „Cache Purge“; ohne Wert wird der Cache-Purge beim Löschen übersprungen |
| `CLOUDFLARE_ZONE_ID` | nein | Zone für den Cache-Purge |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | nein | SMTP-Zugang für E-Mail-Alarme (Port Standard 587, STARTTLS; 465 = implizites TLS) |
| `SMTP_FROM` | nein | Absender der Alarm-Mails |
| `ALERT_EMAIL_TO` | nein | Empfänger der Alarme, kommagetrennt. Ohne `SMTP_HOST`, `SMTP_FROM` und `ALERT_EMAIL_TO` wird nur ins Log geschrieben |
| `DOMAIN` | nein | Domain für Caddy (Standard `localhost`) |

Lokal in `.env.local`, auf dem Server in `.env.production`. Beide Dateien
sind gitignored – **keine Secrets committen**.

## Befehle

| Befehl | Wirkung |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktions-Build / -Server |
| `npm test` | alle Tests (`npm run test:watch` für Watch-Modus) |
| `npm run typecheck` | `tsc --noEmit` – Vitest prüft keine Typen |
| `npm run lint` | ESLint |

CI (`.github/workflows/ci.yml`) führt Typecheck, Lint, Test und Build bei
jedem Push und Pull Request aus.

## Aufbau

```
src/
  app/            Seiten (App Router) und API-Routen unter app/api/
  components/     admin/, gallery/, layout/, sections/, ui/
  lib/            Server- und Client-Logik, Inhalte (*-content.ts)
  instrumentation.ts   Prüfung der Pflicht-Variablen beim Start
data/             SQLite-Datenbank (gitignored)
docs/superpowers/ Spezifikationen und Umsetzungspläne
scripts/          einmalige Hilfsskripte
```

### Daten

`data/wedding.db` enthält Abstimmungen, Galerie-Metadaten, Gästebuch,
Erinnerungen und Einstellungen (`app_config`). Schema und Migrationen stehen
in `src/lib/db.ts`.

### Galerie und Foto-Upload

Fotos laufen **nie durch den App-Server**:

1. Der Browser erzeugt ein Vorschaubild (max. 800 px) und fragt per
   `POST /api/uploads/request` ein signiertes Ticket mit presigned PUT-URLs an
   (15 Minuten gültig, Kennwort-Prüfung für Gäste).
2. Der Browser lädt Vorschaubild und Original direkt nach R2.
3. `POST /api/uploads/complete` prüft die Objekte per `HeadObject` und legt
   die Zeile in SQLite an.
4. Gäste löschen eigene Fotos mit einem einmaligen Token aus dem lokalen
   Speicher des Upload-Geräts (in der DB steht nur dessen Hash); der Admin
   löscht jedes Foto.

Der Admin kann im Dashboard die Galerie zwischen **Öffentlich** und
**Kennwort** umschalten sowie Gästebuch, Erinnerungen, die
„Wer von uns?“-Abstimmung und den **Foto-Upload** einzeln sperren (der Admin
lädt auch bei gesperrtem Upload weiter hoch). Die Bucket-CORS-Regel muss
`PUT, GET, HEAD`, die Header `content-type, content-length` und die
Produktions-Domain sowie `http://localhost:3000` erlauben (Einstellung im
Cloudflare-Dashboard, nicht im Code).

Details: `docs/superpowers/specs/2026-10-12-gallery-design.md`.

## Deployment

Der Produktionsserver betreibt die App **hinter Traefik** (eigene
Compose-Datei mit Labels). Vorlage: `docker-compose.traefik.example.yml`
(Domain, Netzwerk, Entrypoint und Cert-Resolver anpassbar):

```bash
cp .env.example .env.production      # Werte eintragen
cp docker-compose.traefik.example.yml docker-compose.traefik.yml
IMAGE_TAG=1.0.0 docker compose -f docker-compose.traefik.yml pull
IMAGE_TAG=1.0.0 docker compose -f docker-compose.traefik.yml up -d
```

Die `docker-compose.yml` im Repo bringt statt Traefik einen eigenen Caddy und
Autoheal mit; sie ist für einen eigenständigen Betrieb ohne vorhandenen
Reverse-Proxy gedacht (`docker compose up -d`, Domain über `DOMAIN`).

- Das Image heißt `ghcr.io/kowrithv/saru_vinith_wedding:<tag>`; CI baut es
  **nur für Versions-Tags** (`v*.*.*`) auf `main`. Aus dem Git-Tag `v1.0.0`
  wird der Image-Tag **`1.0.0`** (ohne „v"); zusätzlich gibt es
  `sha-<kurz>`. Branch-Pushes erzeugen kein Image – der Compose-Standard
  `IMAGE_TAG=develop` existiert also nicht, `IMAGE_TAG` muss immer gesetzt
  werden. Der Tag `latest` wird nie automatisch gesetzt – er gehört der
  alten Seite (`clean-start`).
- `./data` wird nach `/app/data` gemountet; dort liegen Datenbank und Sicherungen.
- Health-Check: `GET /api/health`.
- Hinter Traefik terminiert dieser das TLS. Die Rate-Limiter lesen die
  Client-IP aus `X-Forwarded-For` (siehe `CLIENT_IP_HEADER`).

### Betrieb

```bash
docker compose -f docker-compose.traefik.yml logs -f web           # Logs
docker compose -f docker-compose.traefik.yml restart web           # Neustart
IMAGE_TAG=<älterer-tag> docker compose -f docker-compose.traefik.yml up -d   # Rollback auf festes Image-Tag
```

**Backup:** Die App sichert die Datenbank beim Start und danach stündlich nach
`data/backups/` (`wedding-YYYYMMDD-HHmmss.db`, UTC). Aufbewahrt werden die
neueste Sicherung, je die erste Sicherung der letzten 48 Stunden und je die
erste jedes Tages der letzten 30 Tage (mehrere Starts in einer Stunde
verdrängen also keine ältere Historie). Jede
Kopie wird mit `PRAGMA integrity_check` geprüft; schlägt das fehl, kommt ein
Alarm. Ab 85 % Plattenbelegung kommt ebenfalls ein Alarm. Alarme gehen ins
Log und, wenn `SMTP_*` und `ALERT_EMAIL_TO` gesetzt sind, per E-Mail (je
Anlass höchstens alle 6 Stunden). Die Start-Meldung beim Deploy zeigt, dass
der Mailversand funktioniert.

**Wiederherstellung:**

```bash
docker compose -f docker-compose.traefik.yml stop web
rm -f data/wedding.db-wal data/wedding.db-shm
cp data/backups/wedding-<Zeitstempel>.db data/wedding.db
docker compose -f docker-compose.traefik.yml start web
```

Die Sicherungen liegen auf derselben Platte wie die Datenbank – sie schützen
vor Fehlbedienung, **nicht** vor einem Plattenausfall. Eine Kopie auf ein
zweites System ist noch offen (`TODO.md`).

## Hilfsskripte

`scripts/compress-memory-images.mjs` verkleinert die Bilder für das
Memory-Spiel nach `public/memory-spiel/`. Es braucht `sharp`, das nicht in
den Abhängigkeiten steht: `npm i --no-save sharp`, dann
`node scripts/compress-memory-images.mjs <Quellordner>`.

## Branches

- `clean-start` – Standard-Branch und Produktionsstand der **alten** Seite;
  nicht ohne Absprache pushen oder mergen.
- `main` – Ziel für Releases der neuen Seite (Versions-Tags).
- `develop` – laufende Arbeit.

Offene Punkte stehen in `TODO.md`.
