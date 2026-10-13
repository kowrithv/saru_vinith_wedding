@AGENTS.md

# Hochzeitswebsite Saruga & Vinith

Hochzeit am **Sa 17.10.2026**, Code-Freeze **Do 15.10. abends**. Während der
Feier betreut niemand den Server – Robustheit geht vor neuen Features.
Überblick, Befehle und Deployment stehen in `README.md`, offene Punkte in
`TODO.md`.

## Sprache

- Oberflächentexte und Code-Kommentare **auf Deutsch**, Bezeichner und
  Commit-Messages auf Englisch (Imperativ, z. B. „Add admin gallery upload").
- Commits enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Befehle

```bash
npm test               # Vitest (jsdom) – prüft KEINE Typen
npm run typecheck      # tsc --noEmit – bei Interface-Änderungen als RED-Signal nutzen
npm run lint
npm run build          # nicht zwei Builds parallel starten (gemeinsames .next)
```

Vor jedem Commit müssen Typecheck, Lint und Test grün sein. Nach dem Löschen
einer Route meldet `tsc` ggf. veraltete Dateien in `.next/types` – dann
`rm -rf .next/types`.

## Architektur in Kürze

- `src/app/` – Seiten und `api/`-Routen (App Router). Jede Seite gibt sich
  selbst Abstand zur fixen Navigation (`pt-24 pb-16` auf dem äußersten
  Element; die Galerie nutzt `pb-28`, damit der schwebende Upload-Knopf nichts verdeckt); im Root-Layout **kein** zusätzliches Padding.
- `src/lib/` – Server-Logik und Inhalte. SQLite über `getDb()`
  (`globalThis.__appDb`, WAL); Schema und idempotente Migrationen in `db.ts`.
- `src/lib/env.ts` + `src/instrumentation.ts` – Pflicht-Variablen, Prozess
  bricht beim Start ab, wenn eine fehlt.
- Galerie: Browser lädt per presigned PUT direkt nach R2 (`r2.ts`,
  `upload-ticket.ts`, `api/uploads/*`). Rohe R2-Keys verlassen den Server
  nie – Clients bekommen nur `GalleryPhotoView` mit URLs.
- Schreib-Sperren (`app-config.ts`, `LOCKABLE_FEATURES`):
  `guestbook | memories | who_votes | gallery_upload` einzeln schaltbar; `gallery_mode` (`public | password`) ist davon getrennt.
- Tailwind v4, Farb-Tokens `dark-blue`, `champagne(-light/-dark)`, `gold`.

## Fallstricke (aus früheren Reviews)

- **Auth:** Das Galerie-Session-Cookie wird mit einem *abgeleiteten* Schlüssel
  signiert (`HMAC(adminSecret, 'gallery-session')`), nie mit dem Admin-Schlüssel
  direkt – sonst ließe es sich als Admin-Cookie fälschen. `isOfficial` darf nur
  aus `isAdminRequest` kommen.
- **Allowlists** als `Map`/`Set`, nicht als Objekt-Literal (Prototype-Keys).
- **Hex-Parsing:** `Buffer.from(str, 'hex')` schneidet ungültige Zeichen
  still ab – vorher per Regex validieren.
- **React 19 / Lint:** Regel `react-hooks/set-state-in-effect` – Zustand
  ableiten oder `useSyncExternalStore` nutzen statt `setState` im Effect.
  Hydration: nichts Zeit- oder Zufallsabhängiges im ersten Render
  (`Countdown` ist das Muster).
- **404-Seite:** `redirect()` in `not-found.tsx` funktioniert nur im Dev-Server
  (307). Der Produktions-Build rendert die Seite vor und liefert sie mit 404
  und leerem Body aus – deshalb Router-Replace + Meta-Refresh + Link. Solche
  Verhalten immer gegen `npm run build` + `next start` prüfen, nicht nur Dev.
- **Touch:** Bedienelemente nie nur per Hover sichtbar machen.
- **Download:** `<a download>` wird bei Cross-Origin ignoriert – per Blob laden.
- **R2/AWS-SDK:** `requestChecksumCalculation: 'WHEN_REQUIRED'` ist nötig.
- **Tests:** `vi.fn`-Mocks, die mit `new` aufgerufen werden, müssen
  `function`-Ausdrücke sein; Regex-Selektoren können mit Label-Texten
  kollidieren. Die Mount-Fetch-Reihenfolge im `AdminDashboard` (Gästebuch,
  Erinnerungen, Galerie) steckt in den Test-Mocks.
- **Rate-Limiter:** `getClientKey` nimmt `X-Forwarded-For` (der Proxy setzt
  ihn). `cf-connecting-ip` nur mit `CLIENT_IP_HEADER=cf-connecting-ip` hinter
  dem Cloudflare-Proxy – ohne Proxy kann jeder Client den Header fälschen.
  Der Server läuft hinter einem **Caddy auf dem Host** (`localhost:3000`, am
  13.10. in der Caddyfile gesehen); die `docker-compose.yml` veröffentlicht
  `127.0.0.1:3000`. Traefik läuft dort für anderes; seine Variante liegt als
  `docker-compose.traefik.yml` bei.

## Arbeitsweise

- Feature-Arbeit läuft Spec → Plan → TDD-Umsetzung → Review → Fix-Durchgang.
  Specs und Pläne liegen in `docs/superpowers/specs|plans/` (mit Datum),
  das Scratch-Verzeichnis `.superpowers/` ist gitignored.
- Neue Pflicht-Variablen in `.env.example`, `src/lib/env.ts`, den Tests und
  `.github/workflows/ci.yml` (Build-Schritt) gemeinsam ergänzen.

## Git

- Arbeitsbranch ist `develop`. **Nie** nach `clean-start` pushen oder mergen –
  das ist die Produktion der alten Seite (Image-Tag `latest`).
- `main` wird vom Nutzer gebaut, sobald das Tag `v1.0.0` bereit ist (nur
  Tags auf `main` erzeugen ein Image). Bis zum Freeze gelten Vorab-Tags
  (`v1.0.0-rc.1`, …), das endgültige `v1.0.0` kommt erst danach. Nicht von sich aus nach `main` mergen
  oder taggen.
- Gepusht wird vom Nutzer: sein SSH-Key ist passwortgeschützt und nur auf
  seinem Rechner nutzbar. Von hier aus ist der Remote nicht erreichbar
  (`git fetch` schlägt fehl) – nicht versuchen, nur lokale Commits liefern.
- Keine Secrets committen: `.env*`, `data/*.db*` sind gitignored.
- Nicht-triviale Entscheidungen oder Rückfragen zu fehlenden Zugangsdaten
  (R2, Cloudflare) an den Nutzer geben, nicht raten.
