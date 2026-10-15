# Cloudflare R2 und Foto-Domain (Betrieb und Neuaufbau)

Stand: 2026-10-16. Alle Fotos liegen in einem **R2-Bucket** (EU-Jurisdiktion) und werden über
eine eigene **Foto-Domain** ausgeliefert. Die Seite selbst läuft unter `vsjourney.de` (DNS bei
netcup, TLS und Weiterleitung über den Caddy auf dem Server). Fotos laufen nie durch den
App-Server: der Browser lädt sie per vorsigniertem PUT direkt in den Bucket (README, „Galerie
und Foto-Upload“).

Die Foto-Domain ist die Subdomain einer Domain, die schon bei Cloudflare liegt
(`foto-wedding.dienstleistungs.cloud`). Eine Custom Domain für einen R2-Bucket verlangt im
Gratis-Plan, dass die **ganze DNS-Zone** der Domain bei Cloudflare liegt, und zwar im
**selben Konto** wie der Bucket. Für `vsjourney.de` (netcup) hätte die Zone umziehen müssen;
das wurde vermieden.

## Die Werte (`.env.production` auf dem Server)

Niemals in Chat, Repo oder Screenshots geben.

| Variable | Woher |
|---|---|
| `R2_ACCOUNT_ID` | R2-Übersicht, Spalte „Account Details“ |
| `R2_BUCKET_NAME` | Name des Buckets |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 → *Manage API tokens* (Abschnitt „API-Token“); das Secret wird nur **einmal** angezeigt |
| `R2_PUBLIC_BASE_URL` | `https://<foto-domain>`, ohne Schrägstrich am Ende |
| `R2_JURISDICTION` | `eu`, weil der Bucket mit EU-Jurisdiktion angelegt wurde |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | Cache-Purge beim Löschen von Fotos (Abschnitt „Cache und Löschen“) |

Nicht setzen: `R2_ENDPOINT` (nur für lokale Tests mit dem Ersatz-Server). Nach jeder Änderung
`docker-compose -f docker-compose.yml up -d`; die App bricht beim Start ab, wenn ein
Pflichtwert fehlt oder `R2_JURISDICTION` ungültig ist.

## CORS-Regel (Bucket → Settings → CORS policy)

```json
[
  {
    "AllowedOrigins": ["https://vsjourney.de", "https://www.vsjourney.de"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- Eingetragen werden die Origins der **Seite** (`vsjourney.de`), nicht die der Foto-Domain,
  ohne Pfad und ohne abschließenden `/`. `http://localhost:3000` nur für Tests, danach
  entfernen.
- `PUT` braucht der Upload, `GET` das **Polaroid** und der **Original-Download**: beide
  holen das Foto per `fetch()` und brauchen dafür die CORS-Köpfe. Die Seite hängt dazu
  `?cors=1` an die Adresse (`photo-fetch.ts`), damit nicht die Kopie der `<img>`-Anfrage ohne
  `Access-Control-Allow-Origin` aus dem Cache kommt.

## API-Token für die App

R2 → *Manage API tokens* → *Create API token*: Berechtigung **Object Read & Write**, beschränkt
auf **genau diesen Bucket**. Access Key ID und Secret Access Key sofort sichern.

## Cache und Löschen

Cloudflare hält die Fotos im Cache (`cache-control: max-age=14400`, vier Stunden). Löscht
der Admin oder ein Gast ein Foto, entfernt die App die Dateien aus R2 und ruft den
**Cache-Purge** auf, und zwar für die normale Adresse und für die `?cors=1`-Adresse. Ohne
Token und Zone ID bleibt ein gelöschtes Foto bis zu vier Stunden abrufbar; das Löschen selbst
schlägt nie fehl.

- Token: *My Profile → API Tokens* → *Create Token* → *Custom token*, Berechtigung **Zone →
  Cache Purge → Purge**, Zonenressource nur die Zone der **Foto-Domain**.
- Zone ID: Übersicht dieser Zone, rechte Spalte.
- Der Purge ist „best effort“ und meldet Fehler nicht: mit falscher Zone oder falschem Token
  schlägt er still fehl. Prüfen: Foto im Admin löschen, dann `https://<foto-domain>/gallery/<id>/thumb.jpg`
  im Browser öffnen. Es muss **sofort 404** liefern.

## Test mit einem echten Handy

- [ ] `/gallery` öffnen, ein Foto hochladen (Name, Kennwort, Kategorie): es erscheint im Raster,
      die Großansicht zeigt das Original, „Original herunterladen“ klappt.
- [ ] Im Bucket liegen `gallery/<id>/thumb.jpg` und `original.<endung>`.
- [ ] Ein Foto **erst ansehen**, dann „Als Polaroid speichern“ (Erinnerungen) und „Original
      herunterladen“: beides muss klappen (CORS, siehe oben).
- [ ] Foto löschen: die Adresse der Vorschau liefert sofort 404.
- [ ] Ein HEIC-Foto (iPhone) und eines mit über 20 MB probieren (Fehlermeldung statt Absturz).

## Wenn etwas nicht klappt

| Symptom | Ursache |
|---|---|
| Upload scheitert sofort | CORS-Regel ohne die Seiten-Origin oder ohne `PUT`; falscher Access Key |
| „blocked by CORS policy“ beim Polaroid oder Download | Origin fehlt in der CORS-Regel, oder die App ist älter als `v1.0.0-rc.3` (dort fehlte `?cors=1`) |
| Gelöschtes Foto ist noch zu sehen | `CLOUDFLARE_API_TOKEN` oder `CLOUDFLARE_ZONE_ID` falsch gesetzt (Zone der Foto-Domain, nicht von `vsjourney.de`) |
| Löschen im Admin meldet einen Fehler | Der Token darf nicht löschen (Object Read & Write nötig) oder gilt für einen anderen Bucket |
| Fotos laden nicht, 404 oder Zertifikatsfehler | Foto-Domain nicht mit dem Bucket verbunden (Bucket → *Settings* → *Custom Domains*) |

## Neu aufsetzen (falls der Bucket neu angelegt werden muss)

1. R2 aktivieren (verlangt ein Zahlungsmittel; das Gratis-Kontingent reicht).
2. Bucket anlegen, **Jurisdiction: European Union** (lässt sich später nicht ändern).
3. CORS-Regel und API-Token wie oben.
4. Foto-Domain verbinden: Bucket → *Settings* → *Custom Domains* → *Connect Domain*. Die Zone
   der Domain muss im selben Konto liegen und aktiv sein; in der Zone darf es noch keinen
   DNS-Eintrag mit dem Namen der Subdomain geben. Kein `r2.dev` für den Betrieb (gedrosselt).
   Hotlink-Schutz und strenge WAF-, Bot- oder Cache-Regeln der Zone können Bilder blockieren,
   die auf `vsjourney.de` eingebettet sind.
5. Cache-Purge-Token und Zone ID, dann alle Werte in die `.env.production`, `up -d`.
6. Test mit dem Handy (oben).

Wenn bei einem Bucket mit EU-Jurisdiktion kein Custom-Domain-Menü erscheint: Notlösung ist ein
zweiter Bucket **ohne** Jurisdiktion (Standort-Hinweis *Western Europe*); dann bleibt
`R2_JURISDICTION` leer.

## Kosten-Wächter

Cloudflare → *Manage Account → Billing → Billable Usage → Create budget alert*, z. B. bei
**5 USD** und **10 USD**. Der Alarm schickt eine E-Mail, deckelt aber nichts. Preise (Stand
12.10.2026): 0,015 USD/GB-Monat, 10 GB gratis, kein Egress; ein mittleres Szenario (ca. 123 GB)
kostet etwa 1,70 USD im Monat.

## Hinweise

- Das Galerie-Kennwort schützt die **Liste**, nicht eine bekannte Objekt-URL: wer eine URL
  hat, kann sie öffnen (lange Zufallsnamen verhindern nur das Erraten). Originale enthalten
  GPS-Daten.
- EU-Jurisdiktion garantiert die Speicherung in der EU; ausgelieferte Inhalte werden über das
  globale Cloudflare-Netz gecacht.
- Abgebrochene Uploads hinterlassen Dateien ohne Datenbankeintrag („verwaiste Objekte“, sie
  sind nirgends sichtbar). Aufräumen: `TODO.md`, nach der Hochzeit.
