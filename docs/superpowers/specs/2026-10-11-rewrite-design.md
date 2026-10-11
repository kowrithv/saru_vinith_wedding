# Design: Hochzeitswebsite Saruga & Vinith — kompletter Neuaufbau

> Status: vom Nutzer abschnittsweise bestätigt am 11.10.2026. Nächster Schritt:
> `writing-plans`-Skill für die Implementierungsplanung.

## Hintergrund

Die bestehende Website (gebaut von einem Freund, siehe `HANDOFF.md` im
Repo-Root für den vollständigen Verlauf bis zu diesem Punkt) wird **komplett
neu geschrieben**. Grund: grundlegendes Unbehagen mit dem Code-Erbe, nicht nur
einzelne Mängel — kein Code wird übernommen, auch nicht bereits reparierte,
lasttestete Logik. Die alte App dient nur als **Referenz für Funktionsumfang
und Inhalte**, nicht als Vorlage für Code.

Harter Rahmen: Hochzeit am **17.10.2026**, Code-Freeze **Do 15.10. abends**,
heute ist **So 11.10.2026** — ca. 4 Arbeitstage. Über 400 Gäste, Server
während der Feier unbeaufsichtigt.

Der Branch `develop` (abgezweigt von `clean-start`) ist für diesen Neuaufbau
angelegt und wurde komplett leergeräumt (Commit „Clean slate: remove all code
for the full rewrite"). Alter Code/Assets bleiben über die Git-Historie
(`clean-start`) abrufbar, falls doch etwas übernommen werden soll (z. B.
Bilder).

## Leitprinzip: „1 Usage, kein Produkt"

Die App muss nicht generisch, konfigurierbar oder langfristig wartbar sein —
sie muss für **einen** Tag zuverlässig funktionieren. Das heißt konkret:

- **Kein generisches Admin-CMS.** Statischer Inhalt (Story, Info, FAQ) steht
  direkt im Code. Änderungen laufen über Commit + Deploy, nicht über eine
  Admin-Oberfläche.
- Zur Laufzeit änderbar bleibt **nur**, was während der Feier wirklich
  gebraucht wird: Galerie-Zugriffsmodus (öffentlich/Kennwort), Admin-Löschung
  einzelner Einträge, ein Notfall-Schalter zum Sperren neuer Gästebuch-/
  Erinnerungs-Einträge.
- Kein `revealAt`/Terminsteuerungs-System. Das Quiz zeigt Live-Ergebnisse,
  es gibt keine „richtige Antwort", die aufgedeckt werden müsste.

## Stack (bewusst beibehalten, nur Code neu)

Next.js (App Router) · React · TypeScript · Tailwind · SQLite
(`better-sqlite3`, WAL) · Docker auf dem bestehenden netcup-Server · GitHub
Actions → GHCR · Cloudflare (Domain + R2 für Fotos).

Ein Wechsel zu einer gemanagten Plattform (z. B. Vercel) wurde erwogen und
bewusst verworfen: Das eigentliche Risiko war nie Rechenleistung, sondern
Betriebsführung (unbeaufsichtigter Server, kein Auto-Restart, unklares TLS).
Das wird stattdessen direkt behoben (siehe „Sicherheit & Betriebshärtung"),
ohne eine neue Plattform/DB-Technologie als zusätzliche Unbekannte
einzuführen.

### Gepinnte Versionen (geprüft am 11.10.2026 gegen npm-Registry und den
offiziellen `nodejs/release`-Zeitplan, nicht aus dem Trainingsstand)

| Paket | Version | Begründung |
|---|---|---|
| Node.js | **24.x LTS „Krypton"** (Docker-Base `node:24-alpine`) | Active LTS bis 20.10.2026, danach Maintenance-LTS bis 30.04.2028 — voll supportet über das Event hinaus. Node 26 wird erst am 28.10.2026 LTS (nach der Hochzeit) und bietet keinen Vorteil, der das Risiko einer „Current"-Linie rechtfertigt. |
| Next.js | 16.4.0 | Aktuell stabil, verlangt React 19 |
| React / react-dom | 19.3.0 | Aktuell stabil, Peer-Requirement von Next 16 |
| TypeScript | **6.0.3**, NICHT `latest` (7.0.2) | `typescript-eslint@8.71.1` (Peer-Dep von `eslint-config-next`) erlaubt nur `typescript: ">=4.8.4 <6.1.0"`. TS 7 ist der neue Go-Compiler, dessen stabile Tooling-API laut Microsoft erst mit 7.1 kommt — damit würde Type-Aware-Linting in der CI riskieren zu brechen. 6.0.3 ist der letzte Patch auf dem ausgereiften, voll kompatiblen Compiler. |
| Tailwind CSS | 4.3.3 | Aktuell stabil |
| better-sqlite3 | 13.0.3 | N-API-basiert → ABI-stabil über Node-Hauptversionen, portablere Alpine/musl-Prebuilds |
| ESLint | 10.12.0 | Erfüllt `eslint-config-next@16.4.0`s Anforderung `eslint >=9.0.0` |
| eslint-config-next | 16.4.0 | Passend zur Next.js-Version |

Diese Tabelle beim Anlegen von `package.json` exakt so pinnen (keine
`^`/`~`-Ranges für diese Kernpakete, damit ein `npm ci` auf dem Server nicht
versehentlich eine neuere, ungetestete Version zieht).

## Datenmodell (SQLite)

```
who_votes          (question_id, voter_id, option)            UNIQUE(question_id, voter_id)
gallery_photos     (id, thumb_key, original_key, uploader_name, delete_token_hash, created_at)
guestbook_entries  (id, name, message, created_at)
memories_entries   (id, name, message, photo_key, created_at)
app_config         (key, value)   -- nur: gallery_mode, admin_secret, writes_locked
```

Bewusst schlank: kein generisches `site_settings`/Page-Visibility-Schema wie
in der alten App.

## Features

| Seite | Umfang |
|---|---|
| Story / Info / FAQ | Statische React-Komponenten, Inhalt direkt im Code, kein `force-dynamic`, von Cloudflare cachebar |
| Quiz „Wer von uns?" | Live-Abstimmung, ein Request pro Gerät+Frage (`UNIQUE(question_id, voter_id)`), Polling mit exponentiellem Backoff + Pause bei verstecktem Tab |
| Memory-Spiel | Rein clientseitig, Bildkarten vorab komprimiert (≤100 KB/Stück), keine Server-Logik |
| Galerie | Thumbnail-Raster, Lightbox zeigt Original direkt, „Original herunterladen", Upload per Kennwort direkt zu R2, öffentlich/Kennwort umschaltbar |
| Gästebuch | Freitext, offen ohne Kennwort, mit Rate-Limit und Admin-Löschfunktion |
| Erinnerungen | Text + optional ein Foto (gleiche R2-Pipeline wie Galerie), Upload-Kennwort nötig, Admin-Löschfunktion. Bleibt bewusst eine eigene Seite/Tabelle, getrennt vom Gästebuch — spätere Zusammenlegung ist möglich, aber nicht Teil dieses Umbaus |
| Admin | Login (Rate-Limit, timing-safes Vergleich), Galerie-Modus-Schalter, Lösch-Liste für Galerie/Gästebuch/Erinnerungen, Schreib-Sperre als Notfall-Schalter |

**Explizit gestrichen:** Kontaktformular (auf der Live-Seite bereits
deaktiviert, kein Ersatz geplant). **Explizit verschoben auf nach der
Hochzeit:** Video-Uploads jeder Art (Galerie und Erinnerungen bleiben zum
Start foto-only).

## R2-Foto-Pipeline (2 Versionen: Thumbnail + Original)

1. `POST /api/uploads/request`: Event-Kennwort prüfen (Rate-Limit greift
   zuerst), pro Foto eine UUID erzeugen, zwei presigned PUT-URLs
   (`gallery/<uuid>/thumb.jpg`, `gallery/<uuid>/original.<ext>`), 15 Min
   gültig, **signierter `content-length`-Header** (verhindert unbegrenzt
   große Uploads trotz App-seitigem Limit — presigned PUT kennt sonst kein
   Größenlimit). Zusätzlich ein **HMAC-signiertes Ticket**, das die
   erwarteten Keys + Größen bindet.
2. Browser erzeugt das Thumbnail selbst: `createImageBitmap` mit
   `{ imageOrientation: 'from-image' }` (sonst falsch gedrehte
   Hochkantfotos) und zweistufigem Downscaling (gegen das
   ~16,7-Megapixel-Canvas-Limit von mobile Safari). Thumbnail und Original
   werden parallel direkt zu R2 hochgeladen — nie über den netcup-Server.
3. `POST /api/uploads/complete` mit dem Ticket: Server prüft per
   `HeadObject`, dass Größe/Pfad zum Ticket passen, legt die Zeile in
   `gallery_photos` an.
4. Löschen (Gast per in `localStorage` gespeichertem Token-Hash, oder Admin):
   entfernt beide R2-Objekte, die DB-Zeile, und löst einen
   Cloudflare-Cache-Purge für beide URLs aus.
5. CORS am Bucket: `PUT, GET, HEAD`, Headers `content-type, content-length`,
   `ExposeHeaders: ETag`. Originale bekommen `Content-Disposition:
   attachment` beim Upload signiert mitgegeben.
6. Fallback bei nicht-dekodierbarem Format (z. B. HEIC außerhalb Safari):
   Original trotzdem hochladen, neutraler Platzhalter als Thumbnail, kein
   Abbruch.

Zwei statt drei Versionen bewusst: R2-Egress ist kostenlos, die Lightbox kann
direkt das Original zeigen. Spart einen Encode-Schritt im Browser (weniger
iOS-Fehlerquellen) und einen Upload-Schritt pro Foto.

## Sicherheit & Betriebshärtung

- Admin-Passwort-Vergleich per `createHash('sha256')` + `timingSafeEqual`,
  **ohne** vorherigen Längenvergleich (kein Orakel über die Passwortlänge).
- In-Memory-Rate-Limiter (`Map` in `globalThis`, z. B. 5 Versuche/15 Min pro
  IP) vor Login, Upload-Request, Gästebuch, Erinnerungen. Bewusst **kein
  Redis**: ein Prozess, ein Container, kein Bedarf für geteilten Zustand über
  Instanzen hinweg; ein Rate-Limit-Reset bei einem (selbst ausgelösten)
  Redeploy ist unkritisch.
- Admin-Cookie: `{expiresAt}.{HMAC(expiresAt, ADMIN_SECRET)}`, 12 h gültig.
  Fehlt `ADMIN_SECRET`, erzeugt die App eins zufällig und speichert es in
  `app_config` — kein fester Fallback.
- Kein `/admin`-Link in Footer/Navigation.
- Zod-Schemas für jeden API-Request-Body; Key-/Pfad-Felder streng gegen ein
  festes Muster geprüft (kein Path-Traversal).
- `src/lib/env.ts`: prüft Pflichtvariablen beim Start, `process.exit(1)` mit
  klarer deutscher Meldung bei fehlenden Werten — kein stilles Degradieren.
- Reverse-Proxy **Caddy** (neuer Compose-Service), automatisches
  Let's-Encrypt-TLS, Cloudflare auf „Full (strict)".
- **`willfarrell/autoheal`** als weiterer Compose-Service: startet den
  `web`-Container neu, wenn der Healthcheck fehlschlägt (Docker selbst tut
  das bei `restart: unless-stopped` nicht).
- Docker-Logging mit `max-size`/`max-file`, Memory-Limit auf dem
  `web`-Service (Ressourcen-Obergrenze, nicht zu verwechseln mit dem
  Rate-Limiter oben).
- Security-Header (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`) über `next.config.ts`.
- `robots.ts` mit `Disallow: /`, `robots: {index:false}` in den Metadaten.
- Stündlicher `VACUUM INTO`-Backup-Cron, rotierend, plus eine Kopie off-box;
  Disk-Space-Alarm bei 85 %.

## Teststrategie

Framework: **Vitest + React Testing Library**. TDD-Ablauf pro Baustein: Test
schreiben → rot sehen → minimal implementieren → grün → refactor. Gilt auch
für kleine Funktionen (z. B. Rate-Limiter zuerst mit „6. Versuch in 15 Min
wird abgelehnt").

Drei Ebenen:
1. **Unit-Tests**: Passwort-Vergleich, HMAC-Cookie-Signierung/-Prüfung,
   Rate-Limiter, Zod-Schemas, R2-Ticket-Signing.
2. **Integrationstests**: API-Routen-Handler direkt importieren, echte
   `better-sqlite3`-Aufrufe gegen eine temporäre DB-Datei pro Testlauf (kein
   DB-Mock) — z. B. „zwei Requests mit derselben `voter_id` → nur eine Stimme
   zählt".
3. **Lasttests als committete, wiederholbare Skripte** (`scripts/load/*.mjs`,
   nicht mehr Wegwerf-Skripte in `/tmp`): Produktions-Build hochfahren,
   parallele Requests gegen Votes/Gästebuch/Upload-Registrierung feuern.

Bewusst nicht automatisiert: echte Gerätetests (iPhone/Android, HEIC,
schlechtes Netz) — bleiben manuell, kurz vor dem Freeze.

## Deployment & Ops

**Docker** (neu geschrieben, mit den Lehren aus dem alten Setup):
- Multi-Stage-Build, `node:22-alpine`, non-root `nextjs` (UID 1001).
- Entrypoint läuft kurz als root, korrigiert Ownership auf `./data`, wechselt
  per `su-exec` zum unprivilegierten User — behebt das
  Bind-Mount-Rechte-Problem strukturell bei jedem Start, nicht nur einmalig.
- `HEALTHCHECK` gegen einen eigenen, **DB-freien** `/api/health`-Endpunkt
  (nicht gegen einen vielgenutzten Polling-Endpunkt).

**docker-compose.yml**, drei Services: `web` (die App), `caddy`
(Reverse-Proxy/TLS), `autoheal` (Neustart bei `unhealthy`).

**CI/CD:**
- `ci.yml`: `tsc --noEmit`, `lint`, `vitest run`, `build` bei jedem
  Push/Pull-Request.
- `docker-build.yml`: baut/pusht nach GHCR nur bei Push auf
  `develop`/`main`/Tags, erst wenn `ci.yml` grün ist.
- Image-Tags: `develop` (Arbeitsstand), `main` (Freigabe-Kandidat), feste
  Versions-Tags (z. B. `v1.0.0`) für den Freeze. `clean-start`/`latest`
  bleibt unberührt, bis bewusst umgeschaltet wird — nie automatisch, erst
  nach bestandenem Lasttest.

## Zeitplan (Rahmen, nicht Teil der Implementierungsplanung)

| Tag | Fokus |
|---|---|
| So 11. / Mo 12.10. | Grundgerüst: Next.js, SQLite-Schema, Vitest-Setup, Admin-Auth, `env.ts`, Docker/Caddy/Autoheal-Skelett, CI. Story/Info/FAQ. |
| Mo / Di 13.10. | Quiz, Memory-Spiel, Gästebuch, Erinnerungen. |
| Di / Mi 14.10. | Galerie + R2-Upload-Pipeline, Admin-Löschfunktion, Galerie-Kennwort-Schalter. |
| Mi / Do 15.10. | Lasttests, echte Gerätetests, Backup-Cron, TLS/Domain final, Fehler beheben. |
| Do 15.10. abends | Freeze: fester Image-Tag. |
| Fr 16.10. | Nur Kontrollen. |
| Sa 17.10. | Hochzeit. |

Bei Zeitdruck hat die Galerie Vorrang vor administrativen Feinheiten
(Gästebuch/Erinnerungen-Löschen kann notfalls manuell/später nachgezogen
werden).

## Offene Punkte für die Implementierungsplanung

- Genaue Content-Texte für Story/Info/FAQ (aus der alten Seite übernehmen als
  Text, nicht als Code — wird beim Schreiben der Seiten final abgeglichen).
- R2-Bucket, R2-API-Token, Cloudflare-API-Token (Cache Purge) — vom Nutzer
  bereitzustellen, blockiert die R2-Pipeline-Implementierung.
- TLS/Domain-Routing: Caddy braucht die finale Domain und DNS-Zugriff
  (Cloudflare) zum Testen von Let's-Encrypt.
- `git push` nach `origin/develop`: aktueller GitHub-Account (`hartingsdev`)
  hat keinen Schreibzugriff auf das Repo — ungeklärt, wie das gelöst wird.
