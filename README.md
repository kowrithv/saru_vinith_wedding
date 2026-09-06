# Saruga & Vinith – Hochzeitswebsite

Diese Website begleitet die Hochzeit von Saruga & Vinith. Sie enthält alle Infos für die Gäste (Ort, Zeit, Ablauf), eine Fotogalerie zum Mitmachen, Spiele, ein Gästebuch und einen Admin-Bereich zur Verwaltung.

## Inhalt

- [Für Gäste: Die Seiten im Überblick](#für-gäste-die-seiten-im-überblick)
- [Passwörter](#passwörter)
- [Admin-Bereich nutzen](#admin-bereich-nutzen)
- [Lokal betreiben](#lokal-betreiben)
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
| `src/lib/config.ts` | Alle Inhalte: Datum/Ort, Zeitstrahl, FAQ, Quiz-Fragen, „Wer von uns“-Fragen, Navigation |
| `data/site-settings.json` | Speichert, welche Seiten sichtbar sind (wird über den Admin-Bereich verwaltet) |
| `data/gallery-uploads.json`, `data/who-votes.json` | Von Gästen erzeugte Daten (Foto-Uploads, Quiz-Stimmen) |

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
