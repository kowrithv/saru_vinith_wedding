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

`gallery_photos` existiert bereits im Schema (`src/lib/db.ts`):

```
gallery_photos (id TEXT PRIMARY KEY, thumb_key TEXT, original_key TEXT,
                 uploader_name TEXT, delete_token_hash TEXT, created_at TEXT)
```

(Wird durch die Erweiterung weiter unten um `category`/`is_official`
ergänzt — siehe „Erweiterung: Kategorien & offizielle Fotos".)

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

Entscheidungen aus dem Vergleich mit der alten (noch live laufenden)
Galerie auf `clean-start` — Masonry-Technik und Lightbox-Verhalten dort
bewährt und übernommen, Rest neu für diesen Rewrite:

- **Raster:** CSS-Masonry wie bereits bei Erinnerungen (`columns-2
  md:columns-3 lg:columns-4 gap-4` + `break-inside-avoid`), jedes Foto
  behält sein echtes Seitenverhältnis. Kategorie-Filter-Chips darüber
  („Alle" + eine Chip pro `galleryCategories`-Eintrag, mit Trefferzahl)
  filtern **clientseitig** den schon geladenen `photos`-Array — kein
  erneuter API-Call pro Kategorie-Wechsel. (`galleryCategories` und
  `isOfficial` sind unten im Abschnitt „Erweiterung: Kategorien &
  offizielle Fotos" definiert und bereits implementiert — dieser
  Abschnitt wurde nachträglich ergänzt, nachdem jener schon stand.)
- **Kachel-Hover:** Zoom-Icon-Overlay (aus der alten App übernommen) plus
  ein Badge unten: bei `isOfficial`-Fotos die Kategorie, bei Gast-Uploads
  „Von `<uploaderName>`".
- **Lightbox:** Vollbild-Dark-Overlay, Chevron-Prev/Next, Tastatur-Nav
  (←/→/Esc), Bild-Zähler „X / Y" — 1:1 aus der alten, bewährten
  Implementierung übernommen. Neu dazu: „Original herunterladen"-Link
  (R2-Egress ist kostenlos, keine dritte Bildversion nötig) und — nur
  beim eigenen Foto, erkennbar über den für diese ID in `localStorage`
  gespeicherten `deleteToken` — ein Löschen-Button direkt in der
  Lightbox.
- **Kennwort-Gate:** bei `mode === 'password'` und nicht freigeschaltet
  ersetzt ein einfaches Card-Formular (Stil wie das bestehende
  Erinnerungen-Kennwortfeld) das komplette Raster, kein Teil-Overlay.

### 5. Upload-UI

- Ein schwebender, goldfarbener Button („Fotos hochladen", fixiert unten
  rechts) blendet ein Formular-Panel von oben in den Seitenfluss ein
  (`AnimatePresence` + `height: auto` — dasselbe Toggle-Pattern wie das
  bestehende Erinnerungen-Formular bzw. die alte Galerie's
  Toggle-Button+Card; kein echtes Modal, keine Fokus-Trap-Komplexität
  nötig).
- Felder: Name, Kennwort (nur im Gast-Kontext sichtbar/Pflicht — siehe
  Admin-Weg unten), Kategorie-Dropdown (Pflicht, Optionen aus
  `galleryCategories`), Dateiauswahl (`multiple`, `accept="image/*"`,
  bis 20 Dateien gemäß Backend-Limit).
- Jede ausgewählte Datei bekommt eine eigene Vorschau-Kachel mit
  Fortschrittsbalken + Status-Icon (⏳ mit %, ✓, ✕ mit Fehlertext) — nötig,
  weil jede Datei einzeln und parallel direkt zu R2 hochgeladen wird
  (anders als die alte App, die alles in einem FormData-POST an den
  eigenen Server schickte und nur einen Gesamt-Status kannte).
- **Admin-Upload-Weg:** dieselbe Komponente ohne Kennwort-Feld, aufgerufen
  von einem eigenen Einstiegspunkt im Admin-Dashboard (nicht auf der
  öffentlichen Galerie-Seite). Der Browser schickt den Admin-Cookie
  automatisch mit; serverseitig entscheidet `isAdminRequest` über
  `isOfficial` — das Frontend muss dafür nichts Besonderes tun.

### 6. Admin-Erweiterung (Frontend)

- Galerie-Modus als **zweigeteilte Button-Gruppe** („Öffentlich" |
  „Kennwort") statt eines Ein/Aus-Schalters, da es eine Zwei-Werte-Auswahl
  ist, kein Lock — visuell als vierte Zeile in derselben Karte wie die
  drei bestehenden Schreib-Sperren-Schalter.
- Neue Galerie-Lösch-Liste, analog zu Gästebuch/Erinnerungen, aber mit
  Thumbnail statt Text-Vorschau, plus Kategorie- und „Offiziell"-Badge
  bei `isOfficial`-Fotos.

### 7. Bild-URLs für die Anzeige (technische Ergänzung für das Frontend)

`R2_PUBLIC_BASE_URL` ist eine server-only Variable (kein `NEXT_PUBLIC_`-
Präfix) — der Client kann sie nicht selbst zu einer Bild-URL
zusammensetzen. Statt die Variable zu duplizieren oder rohe
`thumbKey`/`originalKey`-Pfade an den Client zu geben (unnötiges Leaken
der internen Speicherstruktur), bauen `GET /api/gallery` und
`POST /api/uploads/complete` die fertigen URLs serverseitig und liefern
sie statt der Keys aus. Neues, kleines Modul `src/lib/gallery-photo-view.ts`:

```ts
export interface GalleryPhotoView {
  id: string
  uploaderName: string
  category: string
  isOfficial: boolean
  createdAt: string
  thumbUrl: string
  originalUrl: string
}

export function toGalleryPhotoView(photo: GalleryPhoto): GalleryPhotoView {
  const base = process.env.R2_PUBLIC_BASE_URL ?? ''
  return {
    id: photo.id,
    uploaderName: photo.uploaderName,
    category: photo.category,
    isOfficial: photo.isOfficial,
    createdAt: photo.createdAt,
    thumbUrl: `${base}/${photo.thumbKey}`,
    originalUrl: `${base}/${photo.originalKey}`,
  }
}
```

Ändert die Response-Form von `GET /api/gallery` (`photos`-Einträge haben
jetzt `thumbUrl`/`originalUrl` statt `thumbKey`/`originalKey`) und von
`POST /api/uploads/complete` (`photo`-Objekt ebenso) — reine
Präsentationsschicht, das Datenmodell (`gallery_photos`,
`GalleryPhoto`-Typ in `gallery-photos.ts`) bleibt unverändert.

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

## Erweiterung (2026-10-12, nachträglich): Kategorien & offizielle Fotos

Nutzer-Entscheidung nach Vergleich mit der alten (noch live laufenden)
Galerie auf `clean-start`: diese hatte Kategorie-Filter
(„Kennenlernen"/„Verlobung"/„Paarfotos"/„Empfang") über eine Mischung aus
fest im Code hinterlegten „offiziellen" Fotos (in der alten App nur
Platzhalter-Stockfotos, nie durch echte Fotos ersetzt) und unkategorisierten
Gast-Uploads. Diese Erweiterung bringt das Konzept zurück, aber neu
gebaut: beide Foto-Arten laufen über **dieselbe** `gallery_photos`-Tabelle
und **dieselbe** R2-Pipeline — kein zweites, paralleles System.

**Schema-Erweiterung** (per `ALTER TABLE`, da `gallery_photos` schon
existiert und in Produktion ggf. schon Zeilen hat):

```sql
ALTER TABLE gallery_photos ADD COLUMN category TEXT NOT NULL DEFAULT 'Hochzeit';
ALTER TABLE gallery_photos ADD COLUMN is_official INTEGER NOT NULL DEFAULT 0;
```

**Kategorie-Liste:** fest im Code, `src/lib/gallery-categories.ts`
(genaue Namen legt der Nutzer beim Plan-Review fest, Platzhalter-Vorschlag:
`['Kennenlernen', 'Verlobung', 'Hochzeit', 'Party']`). Gast wählt beim
Hochladen eine Kategorie für den **gesamten Batch** (nicht pro Foto - ein
Gast lädt typischerweise zusammengehörige Fotos eines Moments hoch).

**API-Änderungen:**
- `POST /api/uploads/request`: Body bekommt `category: z.enum(galleryCategories)`,
  gültig für alle Fotos des Requests; `password` wird im Schema optional
  (`z.string().min(1).max(200).optional()`), damit der Admin-Upload-Weg
  kein Dummy-Kennwort mitschicken muss. Wenn die Anfrage einen gültigen
  Admin-Cookie trägt (`isAdminRequest`), wird die Gast-Kennwort-Prüfung
  **übersprungen** (unabhängig davon, ob `password` überhaupt mitgeschickt
  wurde) und `isOfficial: true` ins Ticket gebunden; sonst bleibt
  Kennwort-Pflicht bestehen (fehlt es, 401 wie bisher) und `isOfficial:
  false`. `isOfficial` kommt **nicht** aus dem Request-Body (das wäre vom
  Client fälschbar) — es wird serverseitig aus dem Admin-Auth-Status
  abgeleitet und ins HMAC-signierte Ticket geschrieben, genau wie
  `photoId`/Keys/Größen.
- `TicketPayload` (`upload-ticket.ts`) bekommt zwei neue Felder: `category:
  string`, `isOfficial: boolean`.
- `POST /api/uploads/complete`: schreibt `category`/`isOfficial` aus dem
  Ticket (nicht aus dem Body) in `gallery_photos`.
- `addGalleryPhoto`/`listGalleryPhotos`/`getGalleryPhotoById`
  (`gallery-photos.ts`): `GalleryPhoto` bekommt `category: string`,
  `isOfficial: boolean`.
- `GET /api/gallery`: jedes Foto-Objekt enthält jetzt `category`,
  `isOfficial`.
- `DELETE /api/gallery/[id]`: unverändert - Admin kann weiterhin jedes
  Foto löschen, Gast-Token weiterhin nur das eigene (offizielle Fotos
  haben ohnehin keinen sinnvollen Gast-Token-Besitzer, da sie admin-only
  hochgeladen werden).

**Sicherheit:** `isOfficial` ausschließlich serverseitig aus
`isAdminRequest` abgeleitet und signiert ins Ticket gebunden - ein Gast
kann sein eigenes Foto nicht als „offiziell" markieren, selbst wenn er das
Feld im Request-Body mitschickt (es wird dort nicht gelesen).

**Frontend (Teil des Folge-Plans „Galerie-Frontend"):** Kategorie-Filter-Chips
über dem Raster (wie in der alten App bewährt), Kategorie-Dropdown im
Gast-Upload-Formular, admin-seitiger Upload-Weg ohne Kennwort-Feld (Admin
ist schon authentifiziert).

## Offene Punkte für die Implementierungsplanung

- Exakte Kategorie-Namen: Platzhalter oben, Nutzer bestätigt beim
  Plan-Review.
- Exakte Thumbnail-Zielgröße/-Qualität (Pixel, JPEG-Qualität) wird beim
  Implementieren der Client-Komponente festgelegt, nicht hier.
- Ob die Backend-Erweiterung (Schema/API) und das Galerie-Frontend ein
  gemeinsamer Plan oder zwei getrennte Pläne werden, entscheidet sich beim
  Schreiben des Plans.
