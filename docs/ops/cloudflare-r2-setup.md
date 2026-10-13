# Cloudflare R2 und Domain einrichten (Checkliste)

Stand: 2026-10-13. Domain: `vsjourney.de` (Registrierung und DNS bei **netcup**).
Fotos sollen unter `https://fotos.vsjourney.de` ausgeliefert werden.

## Warum heute Abend und in dieser Reihenfolge

Eine Custom Domain für einen R2-Bucket verlangt im Cloudflare Free-Plan, dass die
**ganze DNS-Zone** bei Cloudflare liegt (Full Setup). Die Registrierung bleibt bei
netcup, nur die Nameserver wechseln. Die Nameserver haben eine TTL von 24 Stunden:
Der Wechsel muss **vor** Mittwoch erledigt sein, nicht erst am Donnerstag.

Reihenfolge: **1. DNS-Bestand sichern → 2. Zone zu Cloudflare → 3. Nameserver bei
netcup umstellen → 4. R2 anlegen → 5. Domain verbinden → 6. Werte auf den Server.**

## 1. DNS-Bestand sichern (vor jeder Änderung)

- [ ] Im netcup-Kundenkontrollpanel (CCP) unter *Domains → vsjourney.de → DNS* alle
      Einträge ansehen und als Screenshot/Text sichern.
- [ ] Besonders notieren: `A`/`AAAA` (Server), `MX` (E-Mail?), `TXT` (SPF, DKIM,
      DMARC, Verifikationen), `CAA`, `CNAME` (z. B. `www`).
- [ ] Prüfen, ob **DNSSEC** aktiv ist (DS-Eintrag). Wenn ja: bei netcup vor dem
      Nameserver-Wechsel deaktivieren und dessen TTL abwarten, sonst ist die
      Domain für validierende Resolver nicht erreichbar.
- [ ] Optional von deinem Rechner:
      `Resolve-DnsName vsjourney.de -Type NS -Server 1.1.1.1`

## 2. Zone bei Cloudflare anlegen

- [ ] Cloudflare Dashboard → *Add a domain* → `vsjourney.de` → Plan **Free**.
- [ ] Die automatisch gefundenen Einträge **mit der Liste aus Schritt 1 abgleichen**
      und fehlende ergänzen (vor allem MX/TXT, falls E-Mail genutzt wird).
- [ ] Für `vsjourney.de` und `www` zunächst **DNS only** (graue Wolke) lassen: die
      Seite läuft weiter direkt über Traefik auf dem netcup-Server.
- [ ] Die beiden zugewiesenen Cloudflare-Nameserver notieren.

## 3. Nameserver bei netcup umstellen

- [ ] CCP → Domain → Nameserver: die bisherigen netcup-Nameserver durch die beiden
      Cloudflare-Nameserver ersetzen.
- [ ] Warten, bis Cloudflare die Zone als **Active** zeigt (Minuten bis Stunden).
- [ ] Prüfen: `https://vsjourney.de` lädt, Zertifikat gültig, E-Mail (falls genutzt)
      funktioniert, `Resolve-DnsName vsjourney.de -Type NS -Server 1.1.1.1` zeigt
      Cloudflare.

## 4. R2-Bucket anlegen

- [ ] Cloudflare → *R2 Object Storage* → aktivieren (Zahlungsmittel nötig; das
      Gratis-Kontingent reicht, es wird nur ein Konto-Zahlungsmittel verlangt).
- [ ] *Create bucket*: Name z. B. `hochzeit-2026-fotos`, **Jurisdiction: European
      Union**. Die Jurisdiktion lässt sich später **nicht ändern**.
- [ ] Notieren: **Account ID** (R2-Übersicht) und Bucket-Name.

### CORS-Regel (Bucket → Settings → CORS policy)

```json
[
  {
    "AllowedOrigins": [
      "https://vsjourney.de",
      "https://www.vsjourney.de",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Die Upload-Anfrage des Browsers sendet nur `Content-Type`. Origins ohne Pfad und
ohne abschließenden `/`. `localhost` nur für Tests, danach entfernen.

### API-Token für die App (Object Read & Write)

- [ ] R2 → *Manage API tokens* → *Create API token* → Berechtigung **Object Read &
      Write**, beschränkt auf **genau diesen Bucket**.
- [ ] **Access Key ID** und **Secret Access Key** sofort sichern: das Secret wird
      nur einmal angezeigt.

## 5. Domain `fotos.vsjourney.de` mit dem Bucket verbinden

- [ ] Erst, wenn die Zone *Active* ist: Bucket → *Settings* → *Custom Domains* →
      *Connect Domain* → `fotos.vsjourney.de`.
- [ ] Cloudflare legt DNS-Eintrag und Zertifikat selbst an. Kein `r2.dev` für den
      Betrieb verwenden (gedrosselt, nicht für Produktion).
- [ ] Prüfen, ob die Domain den Bucket ausliefert (siehe Schritt 7).
- [ ] Wenn bei einem Bucket mit EU-Jurisdiktion kein Custom-Domain-Menü erscheint
      oder die Verbindung scheitert: Cloudflare-Support/Doku prüfen. Notlösung:
      zweiten Bucket **ohne** Jurisdiktion (mit Standort-Hinweis *Western Europe*)
      anlegen und `R2_JURISDICTION` leer lassen.

## 6. Cache-Purge (empfohlen, nicht optional)

Gelöschte Fotos bleiben sonst aus dem Cloudflare-Cache abrufbar, bis dieser abläuft.

- [ ] Cloudflare → *My Profile → API Tokens* → *Create Token* → *Custom token*:
      Berechtigung **Zone → Cache Purge → Purge**, Zonenressource: nur `vsjourney.de`.
- [ ] **Zone ID** steht in der Übersicht der Domain (rechte Spalte).

## 7. Werte auf den Server (`.env.production`)

Niemals in Chat, Repo oder Screenshots geben.

```text
R2_ACCOUNT_ID=<Account ID>
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
R2_BUCKET_NAME=hochzeit-2026-fotos
R2_PUBLIC_BASE_URL=https://fotos.vsjourney.de
R2_JURISDICTION=eu
CLOUDFLARE_API_TOKEN=<Cache-Purge-Token>
CLOUDFLARE_ZONE_ID=<Zone ID>
```

Dazu `ADMIN_PASSWORD`, `UPLOAD_PASSWORD_EMPFANG` (neu setzen, nicht die alten),
`DOMAIN=vsjourney.de` und optional `SMTP_*`/`ALERT_EMAIL_TO`. Container neu
starten; die App bricht beim Start ab, wenn ein Pflichtwert fehlt oder
`R2_JURISDICTION` ungültig ist.

## 8. Test mit einem echten Handy

- [ ] `/gallery` öffnen, ein Foto hochladen (Name, Kennwort, Kategorie).
- [ ] Das Foto erscheint im Raster; Lightbox öffnet das Original; Download klappt.
- [ ] Im R2-Bucket liegen `gallery/<id>/thumb.jpg` und `original.<ext>`.
- [ ] `https://fotos.vsjourney.de/gallery/<id>/thumb.jpg` im Browser öffnen.
- [ ] Foto löschen (Admin) → verschwindet; die URL liefert nach dem Purge 404.
- [ ] Ein Foto mit **HEIC** (iPhone) und eines mit über 20 MB probieren
      (Fehlermeldung statt Absturz).

## 9. Kosten-Wächter

- [ ] Cloudflare → *Manage Account → Billing → Billable Usage → Create budget
      alert*: Schwellen z. B. **5 USD** und **10 USD**. Der Alarm informiert per
      E-Mail, deckelt aber nichts.

## Hinweise

- Das Galerie-Kennwort schützt die **Liste**, nicht eine bekannte Objekt-URL: wer
  eine URL hat, kann sie öffnen (lange Zufallsnamen verhindern nur das Erraten).
  Originale enthalten GPS-Daten.
- EU-Jurisdiktion garantiert die Speicherung in der EU; ausgelieferte Inhalte
  werden über das globale Cloudflare-Netz gecacht.
- Kosten laut Cloudflare-Preisseite (Stand 12.10.2026): 0,015 USD/GB-Monat, 10 GB
  gratis, kein Egress; mittleres Szenario (ca. 123 GB) etwa 1,70 USD/Monat.
