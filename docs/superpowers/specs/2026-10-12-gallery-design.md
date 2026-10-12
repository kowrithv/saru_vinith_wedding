# Galerie + R2-Upload-Pipeline — Design

**Datum:** 2026-10-12
**Bezug:** `docs/superpowers/specs/2026-10-11-rewrite-design.md` (Abschnitte
„R2-Foto-Pipeline", „Datenmodell", „Features", „Offene Punkte") — dieses
Dokument konkretisiert die dort bereits getroffenen Architekturentscheidungen
zu einem umsetzbaren Design, trifft die noch offenen Entscheidungen und legt
die Umgebungsvariablen/Schnittstellen fest.

## Ziel

Gäste können Fotos direkt zu R2 hochladen und in einer Galerie (Thumbnail-
Raster + Lightbox) ansehen. Admin kann die Galerie zwischen „öffentlich" und
„nur mit Kennwort" umschalten und Fotos löschen; Gäste können ihre eigenen
Fotos ebenfalls löschen.

## Scope

**Teil dieses Plans:**
- Galerie-Seite (Thumbnail-Raster, Lightbox, Original-Download)
- R2-Upload-Pipeline (Ticket-Request, Direkt-Upload, Complete, Löschen)
- Galerie-Zugriffs-Modus (öffentlich/Kennwort) mit Admin-Schalter
- Admin-Erweiterung: Modus-Schalter + Lösch-Liste für die Galerie

**Explizit nicht Teil dieses Plans:**
- Foto-Option bei Erinnerungen (nutzt später dieselbe Pipeline, aber eigener,
  späterer Plan — Nutzer-Entscheidung von heute)
- Cloudflare-Cache-Purge-Zugangsdaten einholen (Code behandelt das Fehlen
  dieser Zugangsdaten als Normalfall, s. „Sicherheit")
- Video-Uploads (laut Master-Spec explizit auf nach der Hochzeit verschoben)
- Echte Gerätetests (HEIC auf iOS, schlechtes Netz) — bleiben manuell

## Datenmodell

`gallery_photos` existiert bereits im Schema (`src/lib/db.ts`), unverändert:

```
gallery_photos (id TEXT PRIMARY KEY, thumb_key TEXT, original_key TEXT,
                 uploader_name TEXT, delete_token_hash TEXT, created_at TEXT)
```

Neuer `app_config`-Key: `gallery_mode` (Wert `'public'` oder `'password'`).
Fehlt die Zeile (Default direkt nach Erststart), gilt `'public'` — Nutzer-
Entscheidung von heute: Galerie ist sofort offen, bis Admin sie bewusst
sperrt.

## Neue Abhängigkeiten

`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — R2 ist S3-kompatibel,
das ist der Standardweg, keine echte Alternative.

## Neue Umgebungsvariablen

| Variable | Pflicht? | Zweck |
|---|---|---|
| `R2_ACCOUNT_ID` | Ja | S3-API-Endpunkt (`https://<ID>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | Ja | R2-API-Token (Object Read & Write) |
| `R2_SECRET_ACCESS_KEY` | Ja | s.o. |
| `R2_BUCKET_NAME` | Ja | Ziel-Bucket |
| `R2_PUBLIC_BASE_URL` | Ja | Öffentliche URL (Custom-Domain über Cloudflare), zum Bauen der Anzeige-URLs |
| `CLOUDFLARE_API_TOKEN` | **Nein** | Cache-Purge beim Löschen. Fehlt sie, wird Purge übersprungen (geloggt), kein Fehler. |
| `CLOUDFLARE_ZONE_ID` | **Nein** | s.o. |

Die fünf Pflichtvariablen kommen zu `REQUIRED_KEYS` in `src/lib/env.ts` —
gleiches Verhalten wie bei `UPLOAD_PASSWORD_EMPFANG`: fehlt eine, verweigert
der Server den Start (`process.exit(1)`, deutsche Fehlermeldung). Lokal/CI
bekommen Platzhalterwerte (`.env.local`, `.env.example`, `ci.yml`), genau wie
beim bestehenden Muster.

**Warum Pflicht trotz fehlender echter Werte?** Konsistent mit der Spec-
Vorgabe „kein stilles Degradieren". Lokal/CI laufen mit Platzhaltern weiter
(wie jetzt schon bei `UPLOAD_PASSWORD_EMPFANG`); echte Werte kommen erst beim
Produktions-Deployment dazu, ohne Code-Änderung.

## Architektur

### 1. Galerie-Zugriffs-Modus (neues Konzept — alle anderen Seiten sind frei lesbar)

- `GET /api/gallery`: liefert `{ mode, unlocked, photos }`.
  - Admin-Cookie gültig → immer `photos` (Admin sieht die Galerie unabhängig
    vom Modus, um sie verwalten zu können).
  - `mode === 'public'` → immer `photos`.
  - `mode === 'password'`, kein gültiger `gallery_session`-Cookie →
    `photos: null`, Client zeigt das Kennwort-Formular.
  - `mode === 'password'`, gültiger Cookie → `photos`.
- `POST /api/gallery/unlock`: Body `{password}`, geprüft gegen
  `UPLOAD_PASSWORD_EMPFANG` (Nutzer-Entscheidung: dasselbe Kennwort wie beim
  Hochladen). Rate-limitiert (neue `RateLimiter`-Instanz, 5/15 Min wie Login —
  ein Kennwort-Rätselspiel soll nicht beliebig oft versucht werden können).
  Bei Erfolg: signierter `gallery_session`-Cookie, 7 Tage gültig (länger als
  der Admin-Cookie, da Gäste die Galerie über mehrere Tage rund um die
  Hochzeit ansehen wollen, nicht nur in einer Sitzung).
- Signierung: neues Modul `src/lib/gallery-auth.ts`, importiert die bereits
  generischen `signCookieValue`/`verifyCookieValue` aus `admin-auth.ts` und
  nutzt denselben `getOrCreateAdminSecret(db)` als HMAC-Schlüssel (ein
  App-weites Secret für mehrere Cookie-Zwecke, unterschieden durch
  Cookie-Namen/Inhalt — keine neue Secret-Verwaltung nötig). Der Name
  `getOrCreateAdminSecret` bleibt trotz dieser Zweitverwendung unverändert,
  um bestehenden, getesteten Code nicht unnötig umzubenennen.

### 2. Admin-Erweiterung

- `GET/POST /api/admin/gallery-mode`: exakt dasselbe Muster wie
  `/api/admin/write-lock` (Auth per `isAdminRequest`, GET liefert
  `{mode}`, POST mit `{mode}` setzt und liefert den neuen Stand).
- `AdminPage` ruft beim Mount `write-lock`- und `gallery-mode`-Endpunkt
  parallel ab; beide müssen erfolgreich sein, sonst gilt „nicht angemeldet"
  (gleiches Prinzip wie die bereits parallelen Fetches in `AdminDashboard`
  für Gästebuch/Erinnerungen).
- `AdminDashboard` bekommt einen vierten Abschnitt „Galerie" (Lösch-Liste,
  nutzt dieselben `GET /api/gallery`-Daten, Löschen über
  `DELETE /api/gallery/[id]` mit Admin-Cookie) plus einen Modus-Umschalter
  neben den drei bestehenden Schreib-Sperren-Schaltern.

### 3. Upload-Pipeline

1. `POST /api/uploads/request`: Body `{password, files: [{filename, size,
   contentType}, ...]}`. Kennwort-Prüfung zuerst (gleiche Reihenfolge wie bei
   Erinnerungen). Rate-Limit 30/15 Min (geteiltes Venue-WLAN). Je Foto: UUID,
   Validierung von `contentType` gegen eine feste Liste
   (`image/jpeg`→`jpg`, `image/png`→`png`, `image/webp`→`webp`,
   `image/heic`→`heic`, `image/heif`→`heif`), `size` gegen feste Obergrenzen
   (Original ≤ 20 MB, Thumbnail ≤ 2 MB) — Ablehnung mit 400 bei Überschreitung
   oder unbekanntem Typ. Für jedes gültige Foto: zwei presigned PUT-URLs
   (`gallery/<uuid>/thumb.jpg`, `gallery/<uuid>/original.<ext>`), signierter
   `Content-Length` (verhindert Uploads jenseits der angekündigten Größe,
   auch wenn presigned PUT selbst kein Limit kennt), 15 Min gültig. Dazu ein
   HMAC-signiertes Ticket (`src/lib/upload-ticket.ts`), das photoId, beide
   Keys und beide Größen bindet, signiert mit `getOrCreateAdminSecret(db)`.
2. Client erzeugt das Thumbnail selbst (`createImageBitmap` mit
   `imageOrientation: 'from-image'`, zweistufiges Downscaling gegen Mobile
   Safaris Canvas-Limit, Export als JPEG), lädt Thumbnail und Original
   parallel direkt zu R2 hoch.
3. `POST /api/uploads/complete`: Body `{ticket, uploaderName}`. Server prüft
   das Ticket (Signatur, Ablauf), dann per `HeadObject` (über `src/lib/r2.ts`),
   dass beide Objekte existieren und zur Größe im Ticket passen. Erzeugt
   einen zufälligen `deleteToken`, speichert nur dessen Hash, legt die Zeile
   in `gallery_photos` an. Antwort enthält den `deleteToken` **einmalig im
   Klartext** — Client speichert ihn in `localStorage`, Server speichert ihn
   nie im Klartext.
4. `DELETE /api/gallery/[id]`: Admin-Cookie **oder** passender `deleteToken`
   (Hash-Vergleich, timing-safe wie beim Admin-Passwort). Entfernt beide
   R2-Objekte, die DB-Zeile, versucht (best-effort, kein Fehler bei
   fehlenden Zugangsdaten) einen Cloudflare-Cache-Purge für beide URLs.

`src/lib/r2.ts`: schmaler Wrapper um `@aws-sdk/client-s3` +
`s3-request-presigner` — `createPresignedPutUrl`, `headObject`,
`deleteObjects`. Einziger Ort, der echtes R2 anspricht; alles andere
importiert nur diese Funktionen und mockt sie in Tests (`vi.mock('@/lib/r2')`,
gleiches Muster wie `vi.mock('next/navigation')` an anderer Stelle im Code).

### 4. Galerie-Ansicht

Thumbnail-Raster (Grid, wie bereits bei Erinnerungen etabliert), Klick öffnet
eine Lightbox mit dem Original direkt (keine dritte, separate
Großansicht-Version — R2-Egress ist kostenlos) plus „Original
herunterladen"-Link. Kennwort-Formular bei `mode === 'password'` und nicht
freigeschaltet, sonst direkt das Raster. Eigene Fotos (über die in
`localStorage` gespeicherten `deleteToken`s erkennbar) bekommen einen
Löschen-Button direkt in der Galerie.

## Sicherheit

- Presigned-URL-Ablauf 15 Min, `Content-Length` signiert — kein unbegrenzter
  Upload trotz fehlendem App-seitigem Stream-Limit.
- Ticket-HMAC verhindert, dass `/api/uploads/complete` mit erfundenen
  Keys/Größen aufgerufen wird.
- `deleteToken`: nur Hash gespeichert, timing-safe verglichen — wie beim
  Admin-Passwort, kein Orakel über Token-Länge/-Inhalt.
- Cloudflare-Cache-Purge ist **nie** eine Voraussetzung für erfolgreiches
  Löschen — ein fehlender Purge hinterlässt höchstens kurzzeitig eine
  veraltete Cache-Kopie, kein Sicherheits- oder Korrektheitsproblem.
- CORS am Bucket (`PUT, GET, HEAD`, erlaubte Header `content-type,
  content-length`, `ExposeHeaders: ETag`) wird **nicht** im Code konfiguriert
  — das ist eine Bucket-Einstellung im Cloudflare-Dashboard, nicht Teil
  dieses Plans (bereits mit dem Nutzer besprochen).

## Teststrategie

Ohne echte R2-Zugangsdaten (Nutzer-Entscheidung: erst planen/bauen mit
Mocks, echte Werte folgen später):

1. **Unit:** Ticket-Signierung/-Prüfung (`upload-ticket.ts`), Content-Type/
   Größen-Validierung, `gallery-auth.ts`-Cookie-Signierung — reine Funktionen,
   kein R2 nötig.
2. **Integration:** API-Routen direkt importiert, echte `better-sqlite3`
   gegen eine Testdatenbank, `src/lib/r2.ts` komplett gemockt
   (`vi.mock('@/lib/r2')`) — z. B. „`/api/uploads/complete` mit gültigem
   Ticket, aber `headObject` liefert falsche Größe → Ablehnung", „Admin kann
   trotz `mode: password` löschen", „Gast-Token löscht nur das eigene Foto".
3. **Komponenten:** Galerie-Seite, Kennwort-Formular, Upload-Flow — `fetch`
   gemockt wie bei den bestehenden Seiten-Tests, `createImageBitmap` ebenfalls
   gemockt (jsdom hat keine echte Canvas-Pixel-Verarbeitung).

Echter End-to-End-Test gegen den echten Bucket ist erst möglich, sobald die
Zugangsdaten da sind — das ist ein manueller Schritt vor dem Freeze, kein
automatisierter Test in diesem Plan.

## Offene Punkte für die Implementierungsplanung

- Ob die Implementierung als ein Plan oder zwei (Backend-Pipeline /
  Frontend-Galerie+Admin) aufgeteilt wird, entscheidet sich beim Schreiben
  des Plans — abhängig davon, wie groß die Aufgabenliste tatsächlich wird.
- Exakte Thumbnail-Zielgröße/-Qualität (Pixel, JPEG-Qualität) wird beim
  Implementieren der Client-Komponente festgelegt, nicht hier.
