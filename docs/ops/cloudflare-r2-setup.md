# Cloudflare R2 und Domain einrichten (Checkliste)

Stand: 2026-10-13. Die Seite läuft unter `vsjourney.de` (Registrierung und DNS bei
**netcup**). Die Fotos werden unter einer **Foto-Domain** ausgeliefert, in dieser
Checkliste `<foto-domain>` genannt (z. B. `fotos.<eure-domain>`). Sie landet als
`R2_PUBLIC_BASE_URL` in der `.env.production`; im Code ist keine Domain festgelegt.

## Welche Foto-Domain?

Eine Custom Domain für einen R2-Bucket verlangt im Cloudflare Free-Plan, dass die
**ganze DNS-Zone** der Domain bei Cloudflare liegt (Full Setup) und zwar im
**selben Cloudflare-Konto** wie der Bucket. Daraus folgen zwei Varianten:

| Variante | Wann | Aufwand |
|---|---|---|
| **A:** Subdomain einer Domain, die **schon bei Cloudflare liegt** (Nameserver `*.ns.cloudflare.com`), z. B. `fotos.<andere-domain>` | es gibt so eine Domain im eigenen Cloudflare-Konto | Schritte 1–3 entfallen; `vsjourney.de` bleibt bei netcup unberührt |
| **B:** `fotos.vsjourney.de` | sonst | ganze Zone von `vsjourney.de` zu Cloudflare (Schritte 1–3), Nameserver-TTL bis 24 h |

Variante A ist risikoärmer: kein Eingriff in MX/TXT/DNSSEC der Hochzeitsdomain und
kein Warten auf Nameserver. Bei Variante B muss der Wechsel **vor** Mittwoch
erledigt sein, nicht erst am Donnerstag.

Reihenfolge A: **4. R2 anlegen → 5. Domain verbinden → 6. Purge-Token → 7. Werte
auf den Server.** Reihenfolge B: **1. DNS-Bestand sichern → 2. Zone zu Cloudflare →
3. Nameserver bei netcup umstellen**, danach wie A.

## 1. DNS-Bestand sichern (nur Variante B, vor jeder Änderung)

- [ ] Im netcup-Kundenkontrollpanel (CCP) unter *Domains → vsjourney.de → DNS* alle
      Einträge ansehen und als Screenshot/Text sichern.
- [ ] Besonders notieren: `A`/`AAAA` (Server), `MX` (E-Mail?), `TXT` (SPF, DKIM,
      DMARC, Verifikationen), `CAA`, `CNAME` (z. B. `www`).
- [ ] Prüfen, ob **DNSSEC** aktiv ist (DS-Eintrag). Wenn ja: bei netcup vor dem
      Nameserver-Wechsel deaktivieren und dessen TTL abwarten, sonst ist die
      Domain für validierende Resolver nicht erreichbar.
- [ ] Optional von deinem Rechner:
      `Resolve-DnsName vsjourney.de -Type NS -Server 1.1.1.1`

## 2. Zone bei Cloudflare anlegen (nur Variante B)

- [ ] Cloudflare Dashboard → *Add a domain* → `vsjourney.de` → Plan **Free**.
- [ ] Die automatisch gefundenen Einträge **mit der Liste aus Schritt 1 abgleichen**
      und fehlende ergänzen (vor allem MX/TXT, falls E-Mail genutzt wird).
- [ ] Für `vsjourney.de` und `www` zunächst **DNS only** (graue Wolke) lassen: die
      Seite läuft weiter direkt über den Caddy auf dem netcup-Server.
- [ ] Die beiden zugewiesenen Cloudflare-Nameserver notieren.

## 3. Nameserver bei netcup umstellen (nur Variante B)

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
ohne abschließenden `/`. `localhost` nur für Tests, danach entfernen. Eingetragen
werden die Origins der **Seite** (`vsjourney.de`), nicht die der Foto-Domain – bei
beiden Varianten gleich.

### API-Token für die App (Object Read & Write)

- [ ] R2 → *Manage API tokens* → *Create API token* → Berechtigung **Object Read &
      Write**, beschränkt auf **genau diesen Bucket**.
- [ ] **Access Key ID** und **Secret Access Key** sofort sichern: das Secret wird
      nur einmal angezeigt.

## 5. Foto-Domain mit dem Bucket verbinden

- [ ] Voraussetzung: Die Zone der Foto-Domain steht in Cloudflare auf *Active* und
      liegt **im selben Konto wie der Bucket**. Liegt sie in einem anderen Konto,
      lässt sie sich im Bucket nicht verbinden.
- [ ] In der Zone darf es noch keinen DNS-Eintrag mit dem Namen der Subdomain geben
      (sonst meldet Cloudflare einen Konflikt).
- [ ] Bucket → *Settings* → *Custom Domains* → *Connect Domain* → `<foto-domain>`.
- [ ] Cloudflare legt DNS-Eintrag und Zertifikat selbst an. Kein `r2.dev` für den
      Betrieb verwenden (gedrosselt, nicht für Produktion).
- [ ] Bei Variante A dient die Zone evtl. schon anderen Zwecken: zonenweite
      Einstellungen ansehen. **Hotlink-Schutz** (*Scrape Shield*) sowie strenge
      WAF-/Bot- oder Cache-Regeln können Bilder blockieren, die auf einer anderen
      Seite (`vsjourney.de`) eingebettet sind.
- [ ] Prüfen, ob die Domain den Bucket ausliefert (siehe Schritt 8).
- [ ] Wenn bei einem Bucket mit EU-Jurisdiktion kein Custom-Domain-Menü erscheint
      oder die Verbindung scheitert: Cloudflare-Support/Doku prüfen. Notlösung:
      zweiten Bucket **ohne** Jurisdiktion (mit Standort-Hinweis *Western Europe*)
      anlegen und `R2_JURISDICTION` leer lassen.

## 6. Cache-Purge (empfohlen, nicht optional)

Gelöschte Fotos bleiben sonst aus dem Cloudflare-Cache abrufbar, bis dieser abläuft.

- [ ] Cloudflare → *My Profile → API Tokens* → *Create Token* → *Custom token*:
      Berechtigung **Zone → Cache Purge → Purge**, Zonenressource: nur die Zone der
      **Foto-Domain** (bei Variante A also *nicht* `vsjourney.de`).
- [ ] **Zone ID** dieser Zone steht in ihrer Übersicht (rechte Spalte).
- [ ] Der Purge ist „best effort" und meldet Fehler nicht: mit falscher Zone oder
      falschem Token schlägt er still fehl. Darum in Schritt 8 ausdrücklich prüfen.

## 7. Werte auf den Server (`.env.production`)

Niemals in Chat, Repo oder Screenshots geben.

```text
R2_ACCOUNT_ID=<Account ID>
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
R2_BUCKET_NAME=hochzeit-2026-fotos
R2_PUBLIC_BASE_URL=https://<foto-domain>
R2_JURISDICTION=eu
CLOUDFLARE_API_TOKEN=<Cache-Purge-Token>
CLOUDFLARE_ZONE_ID=<Zone ID der Foto-Domain>
```

Dazu `ADMIN_PASSWORD`, `GUEST_PASSWORD` (neu setzen, nicht die alten),
`DOMAIN=vsjourney.de` und optional `SMTP_*`/`ALERT_EMAIL_TO`. Container neu
starten; die App bricht beim Start ab, wenn ein Pflichtwert fehlt oder
`R2_JURISDICTION` ungültig ist.

## 8. Test mit einem echten Handy

- [ ] `/gallery` öffnen, ein Foto hochladen (Name, Kennwort, Kategorie).
- [ ] Das Foto erscheint im Raster; Lightbox öffnet das Original; Download klappt.
- [ ] Im R2-Bucket liegen `gallery/<id>/thumb.jpg` und `original.<ext>`.
- [ ] `https://<foto-domain>/gallery/<id>/thumb.jpg` im Browser öffnen (damit es im
      Cloudflare-Cache liegt).
- [ ] Foto löschen (Admin) → verschwindet; dieselbe URL liefert **sofort 404**. Kommt
      noch das Bild, ist der Purge wirkungslos: `CLOUDFLARE_ZONE_ID` und die Zone
      des Tokens prüfen (Schritt 6).
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
