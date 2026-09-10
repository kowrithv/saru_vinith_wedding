# Saruga & Vinith – Hochzeitswebsite

Diese Website begleitet die Hochzeit von Saruga & Vinith. Sie enthält alle Infos für die Gäste (Ort, Zeit, Ablauf), eine Fotogalerie zum Mitmachen, Spiele, ein Gästebuch und einen Admin-Bereich zur Verwaltung.

## Inhalt

- [Für Gäste: Die Seiten im Überblick](#für-gäste-die-seiten-im-überblick)
- [Passwörter](#passwörter)
- [Admin-Bereich nutzen](#admin-bereich-nutzen)
- [Lokal betreiben](#lokal-betreiben)
- [Deployment mit Docker](#deployment-mit-docker)
- [CI/CD (GitHub Actions)](#cicd-github-actions)
- [Sonstiges](#sonstiges)

---

## Für Gäste: Die Seiten im Überblick

| Seite | Adresse | Was passiert dort |
|---|---|---|
| Startseite | `/` | Überblick, Countdown, Kurzinfos zum Empfang |
| Unsere Geschichte | `/story` | Zeitstrahl der Beziehung |
| Hochzeitsinfos | `/info` | Datum, Uhrzeit, Ort mit interaktiver Karte, Parken, Ablauf des Tages |
| Galerie | `/gallery` | Fotos ansehen, eigene Fotos hochladen (Kennwort nötig, siehe unten) |
| Quiz | `/quiz` | Zwei Modi: klassisches Wissensquiz und „Wer von uns?“ (Live-Abstimmung) |
| Gästespiel | `/memory-spiel` | Memory-Spiel mit Fotos des Paares |
| Erinnerungen | `/memories` | Gäste können Text/Foto/Video-Erinnerungen teilen |
| Gästebuch | `/guestbook` | Nachrichten für das Brautpaar hinterlassen |
| Kontakt *(aktuell ausgeblendet)* | `/contact` | Kontaktformular, RSVP-Hinweis |

### Hochzeitsinfos & Karte

Auf `/info` gibt es eine interaktive Karte (OpenStreetMap, kein Google-Konto nötig) mit einem Pin genau auf der Begegnungsstätte. Über den Button **„Route planen“** öffnet sich direkt die Navigation zum Ort (Google Maps).

### Foto-Uploads (Galerie & Erinnerungen)

Gäste können auf `/gallery` eigene Fotos hochladen. Dafür brauchen sie:
1. Ihren Namen
2. Das Veranstaltungs-Kennwort (siehe [Passwörter](#passwörter))

Ist Google Drive konfiguriert (ist es aktuell, siehe unten), landet jedes hochgeladene Foto zusätzlich automatisch in einem Google-Drive-Ordner.

### Quiz – „Wer von uns?“

Zusätzlich zum klassischen Quiz gibt es unter `/quiz` den Modus „Wer von uns?“: Gäste geben einmalig ihren Namen ein und stimmen dann bei ca. 14 Fragen ab, ob eher Saruga, Vinith oder beide zutreffen. Sie sehen sofort, wie die anderen Gäste live abgestimmt haben (in Prozent). Die richtige Antwort wird erst sichtbar, wenn ihr sie im Admin-Bereich freischaltet (z. B. live bei der Feier).

---

## Passwörter

| Zweck | Passwort |
|---|---|
| Foto-Upload (Galerie & Erinnerungen) | `Empfang2026` |
| Admin-Bereich (`/admin`) | `SaruVinith2026!` |

Das Foto-Upload-Kennwort könnt ihr euren Gästen z. B. auf der Einladungskarte oder per Nachricht mitteilen. Beide Passwörter lassen sich in der Datei `.env.local` ändern (siehe [Lokal betreiben](#lokal-betreiben)) – danach muss der Server einmal neu gestartet werden.

---

## Admin-Bereich nutzen

Erreichbar unter **`/admin`** (Link ganz unten im Footer der Website). Einloggen mit dem Admin-Passwort oben.

Im Admin-Bereich könnt ihr:

**Seiten ein-/ausblenden**
Für jede Seite (Story, Info, Galerie, Quiz, …) gibt es einen Schalter, um sie für Gäste sichtbar oder unsichtbar zu machen, sowie ein Datum/Uhrzeit-Feld, um eine automatische Freischaltung zu einem bestimmten Zeitpunkt zu planen (z. B. das Gästebuch erst ab dem Hochzeitstag freischalten). Änderungen über **Speichern** bestätigen.

**„Wer von uns?“ verwalten**
Weiter unten auf der Admin-Seite seht ihr für jede der 14 Fragen:
- Wie viele Stimmen jede Antwortmöglichkeit (Saruga / Vinith / Beide) aktuell hat
- Über **„Wer hat wie gestimmt?“** eine ausklappbare Liste mit den Namen der Gäste, sortiert nach ihrer Antwort (nur hier sichtbar, Gäste sehen diese Namen nie)
- Ihr könnt die **richtige Antwort** anklicken (wird blau markiert) und über den Schalter **„Noch verborgen“ / „Für Gäste sichtbar“** live freischalten – z. B. während der Feier, damit alle Gäste in Echtzeit sehen, wer richtig getippt hat
- Nicht vergessen: unten auf **Speichern** klicken

---

## Lokal betreiben

Voraussetzung: [Node.js](https://nodejs.org) ist installiert.

```bash
npm install       # einmalig, installiert alle Pakete
npm run dev       # startet die Website lokal auf http://localhost:3000
```

Zum Beenden im Terminal `Strg + C` drücken.

Für einen echten Produktions-Build (z. B. vor einem Deployment):

```bash
npm run build
npm run start
```

### Wichtige Dateien

| Datei | Zweck |
|---|---|
| `.env.local` | Passwörter, Secrets, Google-Drive-Zugangsdaten – niemals ins Git-Repository commiten |
| `.env.example` | Vorlage für `.env.local` bzw. `.env.production` mit allen Variablen (ohne echte Werte) |
| `src/lib/config.ts` | Alle Inhalte: Datum/Ort, Zeitstrahl, FAQ, Quiz-Fragen, „Wer von uns“-Fragen, Navigation |
| `data/site-settings.json` | Speichert, welche Seiten sichtbar sind (wird über den Admin-Bereich verwaltet) |
| `data/gallery-uploads.json`, `data/who-votes.json` | Von Gästen erzeugte Daten (Foto-Uploads, Quiz-Stimmen) |

---

## Deployment mit Docker

Die Website läuft als fertiges Docker-Image. GitHub Actions baut das Image bei
jeder Änderung am Hauptbranch automatisch und legt es in der GitHub Container
Registry ab:

```
ghcr.io/kowrithv/saru_vinith_wedding:latest
```

### Erste Einrichtung auf dem Server

```bash
git clone https://github.com/kowrithv/saru_vinith_wedding.git
cd saru_vinith_wedding

cp .env.example .env.production   # danach mit den echten Werten füllen

docker compose pull               # aktuelles Image von GitHub holen
docker compose up -d              # Website starten
```

Die Website läuft danach auf `http://<server>:3000`. Für einen anderen Port die
linke Zahl in der `ports`-Zeile der `docker-compose.yml` anpassen (z. B.
`"8080:3000"`).

Der Container läuft aus Sicherheitsgründen nicht als root, sondern als Benutzer
1001 – der Entrypoint korrigiert die Rechte auf `./data` und
`./public/uploads` aber bei jedem Start automatisch, ein manuelles `chown` auf
dem Server ist nicht nötig.

### Updates einspielen

```bash
docker compose pull && docker compose up -d
```

Eine bestimmte Version statt der neuesten starten:

```bash
IMAGE_TAG=v1.0.0 docker compose pull
IMAGE_TAG=v1.0.0 docker compose up -d
```

### Gästedaten bleiben erhalten

Zwei Ordner werden vom Server in den Container gemountet, damit ein Update
keine Daten löscht:

| Ordner auf dem Server | Im Container | Inhalt |
|---|---|---|
| `./data` | `/app/data` | Seiten-Sichtbarkeit, „Wer von uns?“-Stimmen |
| `./public/uploads` | `/app/public/uploads` | Von Gästen hochgeladene Fotos |

Für ein Backup reicht es, diese beiden Ordner zu sichern.

### Nützliche Befehle

```bash
docker compose logs -f       # Logs mitlesen
docker compose ps            # Status inkl. Healthcheck
docker compose restart       # Neu starten
docker compose down          # Stoppen (Daten in ./data bleiben erhalten)
```

> **Wichtig:** Nach jeder Änderung an `.env.production` muss der Container mit
> `docker compose up -d` neu erstellt werden – ein `restart` allein übernimmt
> die neuen Werte nicht immer.

---

## CI/CD (GitHub Actions)

Zwei Workflows liegen unter `.github/workflows/`:

| Workflow | Läuft wann | Was er tut |
|---|---|---|
| `ci.yml` | bei jedem Push und Pull Request | `npm ci`, Typprüfung (`tsc --noEmit`), `npm run lint`, `npm run build` |
| `docker-build.yml` | bei Push auf `clean-start`, bei Tags `v*.*.*`, oder manuell | baut das Docker-Image und lädt es nach `ghcr.io/kowrithv/saru_vinith_wedding` hoch |

Vergebene Image-Tags:

- `latest` – immer der aktuelle Stand des Hauptbranches
- `clean-start` – Branch-Name
- `sha-<kurz-hash>` – der genaue Commit
- `1.2.3` – wenn ein Git-Tag `v1.2.3` gesetzt wird

Ein Release veröffentlichen:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Der Workflow braucht keine zusätzlichen Secrets – er meldet sich mit dem
automatischen `GITHUB_TOKEN` an der Registry an. Damit das klappt, muss unter
**Settings → Actions → General → Workflow permissions** „Read and write
permissions“ aktiv sein.

### GitHub Pages

GitHub Pages kann diese Website **nicht** hosten. Pages liefert ausschließlich
statische Dateien aus, die Seite braucht aber einen laufenden Node-Server für:

- Foto-Uploads in Galerie und Erinnerungen (`/api/gallery/upload`, `/api/memories/upload`)
- die Live-Abstimmung bei „Wer von uns?“ (`/api/who-votes/vote`)
- den Admin-Login und das Ein-/Ausblenden von Seiten (`/api/admin/*`)
- das Speichern der Daten in `data/` und `public/uploads/`

Ein statischer Export (`output: 'export'`) würde genau diese Funktionen
entfernen. Deshalb wird das Docker-Image oben als Deployment-Weg genutzt – z. B.
auf einem eigenen Server, einer VM oder bei einem Anbieter, der Docker-Images
startet.

---

## Sonstiges

### Google Drive Sync

Ist bereits eingerichtet und aktiv: Fotos aus der Galerie und den Erinnerungen landen automatisch zusätzlich in euren Google-Drive-Ordnern. Die Zugangsdaten dafür stehen in `.env.local` (`GOOGLE_OAUTH_*` und `GOOGLE_DRIVE_*_FOLDER_ID`). Ohne diese Variablen würden Uploads einfach nur lokal gespeichert – aktuell aber nicht relevant, da schon konfiguriert.

### Kontaktseite ausgeblendet

Die Kontaktseite (`/contact`) ist aktuell über den Admin-Bereich ausgeblendet (Schalter bei „Kontakt“ auf `/admin`). Sie taucht deshalb weder in der Navigation noch im Footer auf; die entsprechenden Buttons/Links auf der Startseite und der FAQ-Seite verweisen stattdessen direkt auf `mailto:hallo@saru-vinith.de`. Um die Seite wieder freizuschalten, einfach im Admin-Bereich den Schalter bei „Kontakt“ umlegen und speichern.

### Tamilische Hochzeit 2027

Der Bereich zur tamilischen Hochzeit ist aktuell absichtlich ausgeblendet (Tab auf `/info`, Karte auf der Startseite, Badge im Hero), bis Datum und Details feststehen. Einfach in `src/lib/config.ts` die Zeile

```ts
export const showTraditionalWeddingTab = false
```

auf `true` setzen, um alles wieder einzublenden.

### Bilder fürs Memory-Spiel ergänzen

1. Bilddatei in den Ordner `public/memory-spiel/` legen
2. Den Pfad in der Liste `memoryGameImages` in `src/lib/config.ts` ergänzen, z. B. `/memory-spiel/foto-4.png`

Bis zu 8 Fotos werden genutzt, fehlende Paare werden automatisch mit Icons aufgefüllt.
