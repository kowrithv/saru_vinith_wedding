# Betriebs-Absicherung und Upload-Feinschliff — Design

Stand: 2026-10-12. Ergänzt die Master-Spec
(`2026-10-11-rewrite-design.md`, Abschnitt „Deployment & Ops") und die
Galerie-Spec (`2026-10-12-gallery-design.md`). Wird als **ein** Plan mit drei
Teilen umgesetzt.

## Ziel

Am Hochzeitstag betreut niemand den Server. Dieses Paket sorgt dafür, dass

1. der Foto-Upload im Notfall mit einem Klick abgeschaltet werden kann,
2. die Datenbank regelmäßig gesichert wird und die verantwortliche Person
   per E-Mail erfährt, wenn Sicherung oder Platte ein Problem haben,
3. Gäste auf dem Handy beim Hochladen sehen, was passiert, und bei hängenden
   Uploads nicht festsitzen.

## Entscheidungen

Vom Nutzer (2026-10-12):

- **Backup-Ziel: erstmal nur lokal**, die Off-Box-Kopie folgt, sobald es ein
  Ziel gibt. Schützt also vor versehentlich gelöschten oder zerstörten
  Daten, **nicht** vor dem Ausfall der Server-Platte (steht in `TODO.md`).
- **Alarm-Kanal: E-Mail** (SMTP), kein Webhook.

Von mir (Rulings, bitte korrigieren, wenn falsch):

| Thema | Entscheidung | Begründung |
|---|---|---|
| Wo läuft das Backup? | In der App (Timer aus `instrumentation.ts`), nicht per Host-Cron | Keine Docker-/Host-Änderung, hier real testbar, Fehler können sofort gemeldet werden |
| Admin beim gesperrten Upload | Darf weiter hochladen | Offizielle Fotos sollen auch im Notfall möglich bleiben (wie der Admin-Bypass im Galerie-Modus) |
| Bereits ausgestellte Tickets bei Sperre | `/api/uploads/complete` lehnt sie ab (außer Admin-Tickets) | Sonst liefen laufende Uploads nach dem „Notaus" noch bis zu 15 Minuten weiter |
| Vorschau in der Upload-Liste | Das ohnehin erzeugte Thumbnail, nicht das Original | Original-Vorschau würde bei 20+ Fotos das iPhone-Speicherproblem wiederholen |
| Neue Abhängigkeit | `nodemailer` (keine eigenen Abhängigkeiten) | Standard für SMTP; ein selbstgebauter SMTP-Client wäre fehleranfälliger |

## Teil 1 — Foto-Upload-Schalter

Vierter Schalter im bestehenden Schreib-Sperren-System.

- `LockableFeature` bekommt `'gallery_upload'`; `app_config`-Schlüssel
  `gallery_upload_locked`. `FEATURES` und `z.enum` in
  `api/admin/write-lock/route.ts` werden aus **einer** `as const`-Liste
  abgeleitet (erledigt nebenbei den Minor „Feature-Namen können abweichen").
- Admin-Dashboard: vierte Zeile „Foto-Upload" in der Schalter-Karte
  (gleiche Optik, Label und Zustandstexte wie die anderen).
- **Durchsetzung** (Antwort `423` wie beim Gästebuch, Text „Foto-Uploads sind
  derzeit pausiert."):
  - `POST /api/uploads/request`: für Nicht-Admins, **vor** der
    Kennwort-Prüfung.
  - `POST /api/uploads/complete`: wenn gesperrt und das Ticket nicht
    `isOfficial` ist.
- `GET /api/gallery` liefert zusätzlich `uploadsLocked: boolean`. Die
  Galerie-Seite blendet bei `true` den schwebenden Button aus und zeigt
  über dem Raster einen ruhigen Hinweis „Das Hochladen ist gerade pausiert."
  Ein geöffnetes Formular zeigt die 423-Meldung des Servers (der
  Fehlerpfad existiert bereits).
- Die Galerie-Ansicht bleibt unberührt; Löschen bleibt möglich.

## Teil 2 — Backup und Alarme

### Bausteine

| Datei | Aufgabe |
|---|---|
| `src/lib/backup.ts` | `createBackup(db, dir, now)`: Online-Backup per `db.backup()`, danach `PRAGMA integrity_check` auf der Kopie; Dateiname `wedding-YYYYMMDD-HHmmss.db` (UTC). `selectBackupsToDelete(names, now)`: reine Funktion. `pruneBackups(dir, now)`. |
| `src/lib/alerts.ts` | `sendAlert({ key, subject, body })`: schreibt immer ins Log; schickt zusätzlich eine E-Mail, wenn SMTP konfiguriert ist; Abkühlzeit je `key` (6 h), persistiert in `app_config` (überlebt Neustarts). Ein Fehler beim Versand wird geloggt, nie geworfen. |
| `src/lib/ops-scheduler.ts` | `startOpsScheduler()`: beim Start eine Info-Mail „App gestartet", sofort ein Backup, danach stündlich Backup + Aufräumen und alle 10 Minuten die Plattenprüfung. Timer sind `unref()`, nichts hält den Prozess am Leben. Einmalig je Prozess (`globalThis`-Flag). |
| `src/instrumentation.ts` | Ruft nach der Env-Prüfung `startOpsScheduler()` per dynamischem Import auf, nur in `NODE_ENV === 'production'` und `NEXT_RUNTIME === 'nodejs'`. Die Env-Prüfung bleibt synchron (bestehende Tests). |

### Verhalten

- **Ort:** `<Ordner der DB>/backups/` (Standard `data/backups/`), liegt im
  gemounteten `./data`-Volume und überlebt damit Container-Neuerstellung.
- **Aufbewahrung:** die letzten 48 stündlichen Sicherungen plus je eine pro
  Tag der letzten 30 Tage (die jeweils erste des Tages).
- **Fehler:** schlägt Backup oder Integritätsprüfung fehl, wird eine
  Alarm-Mail (`key: backup-failed`) gesendet; eine defekte Kopie wird
  gelöscht, damit sie keine gute Rotation verdrängt.
- **Platte:** Belegung des Dateisystems der DB per `fs.statfs`; ab **85 %**
  Alarm (`key: disk-full`). Erwartet ist eine kleine Datenbank (Fotos
  liegen in R2) — der Alarm fängt vor allem Log- und Docker-Wachstum ab.
- **Konfiguration** (alle optional; ohne `SMTP_HOST`, `SMTP_FROM` und
  `ALERT_EMAIL_TO` gibt es nur Log-Zeilen):
  `SMTP_HOST`, `SMTP_PORT` (Standard 587), `SMTP_USER`, `SMTP_PASSWORD`,
  `SMTP_FROM`, `ALERT_EMAIL_TO` (kommagetrennt). Port 465 = implizites TLS,
  sonst STARTTLS mit Pflicht (`requireTLS`). Verbindungs-/Socket-Timeout
  10/15 s, damit ein hängender Mailserver nie etwas blockiert.
- **Wiederherstellung** (README): Container stoppen, `wedding.db-wal` und
  `-shm` löschen, gewünschte Sicherung als `data/wedding.db` kopieren,
  Container starten.

### Bewusst nicht Teil davon

- Off-Box-Kopie (kein Ziel, Entscheidung des Nutzers) — `TODO.md`.
- Admin-Anzeige „letztes Backup": der Zustand ist per Log und
  `ls data/backups` sichtbar; mehr wäre Zusatz-UI ohne Bedarf.
- Externer Uptime-Monitor (Konfiguration beim Anbieter, kein Code).

## Teil 3 — Upload-Feinschliff

1. **Vorschaukacheln:** Jede Zeile der Upload-Liste zeigt ab dem Hochladen
   ein 48-px-Kachelbild aus dem erzeugten Thumbnail (`URL.createObjectURL`,
   wird beim Ersetzen/Entladen freigegeben). Bei Platzhalter-Thumbnails
   (nicht dekodierbar) ein neutrales Bild-Icon. Vor dem Hochladen nur der
   Dateiname wie bisher.
2. **Eingabefelder mit 16 px:** Alle `input`/`select`/`textarea` bekommen
   `text-base` statt `text-sm`, damit iOS beim Fokussieren nicht hineinzoomt.
3. **Einklappbare Admin-Abschnitte:** Gästebuch, Erinnerungen und Galerie
   als einklappbare Abschnitte (Button mit `aria-expanded`/`aria-controls`,
   Anzahl im Titel). Gästebuch und Erinnerungen starten eingeklappt, die
   Galerie offen. Der Galerie-Fehlerzustand bleibt im Abschnitt sichtbar.
4. **Timeout und Abbrechen:** Jeder Datei-Upload hat ein Zeitlimit von
   5 Minuten (`AbortController` + `setTimeout`, kein `AbortSignal.any`, wegen
   älterer iOS-Versionen); bei Ablauf wird die Datei als Fehler markiert
   („Zeitüberschreitung – bitte erneut versuchen."). Ein „Abbrechen"-Knopf
   ist während des Hochladens sichtbar, bricht laufende Übertragungen ab,
   startet keine weiteren Gruppen, und die betroffenen Dateien gehen auf
   „abgebrochen" zurück und lassen sich erneut hochladen.

## Tests

- **Schalter:** Konfig-Round-Trip, beide Routen (423 für Gast, durchgelassen
  für Admin, `complete` mit Admin- und Gast-Ticket), `GET /api/gallery`
  liefert `uploadsLocked`, Seite blendet Button aus, Dashboard schaltet
  nur diese Zeile, Schleife über alle Features in der Write-Lock-Route.
- **Backup:** echte `better-sqlite3`-Datenbank in temporärem Ordner;
  Sicherung ist lesbar und enthält die Daten; `selectBackupsToDelete` mit
  Tabelle von Zeitpunkten; Integritätsfehler löscht die Kopie und alarmiert.
- **Alarme:** SMTP-Transport gemockt; ohne Konfiguration nur Log; Abkühlzeit
  über Neustart hinweg (zweite Instanz liest `app_config`); Versandfehler
  werden verschluckt und geloggt.
- **Scheduler:** Fake-Timer; startet nur einmal; in `test`/`development`
  nicht aktiv; Plattenprüfung mit gemocktem `statfs`.
- **Upload-Teil:** Vorschau erscheint nach dem Thumbnail und wird
  freigegeben; Zeitlimit und Abbrechen mit Fake-Timern; Admin-Abschnitte
  klappen auf/zu; eine Prüfung, dass keine Formularfelder mit `text-sm`
  übrig sind.
- Vor Abschluss: Typecheck, Lint, alle Tests, `npm run build`.

## Risiken

- **E-Mail ist am Eventtag der schwächste Kanal** (Spam-Ordner, SMTP-
  Passwort läuft ab). Gegenmittel: Die Start-Mail beim Deploy dient als
  Konfigurationsprobe; sie sollte am Mi/Do einmal ankommen.
- **Backup in der App** läuft nicht, wenn die App abgestürzt ist. Dann
  ändern sich aber auch keine Daten, und der Uptime-Monitor meldet den
  Ausfall.
- **Lokale Kopie auf derselben Platte:** siehe Entscheidung oben.
