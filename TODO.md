# TODO

## Vor Go-Live zu erledigen (gefunden im Gästebuch/Erinnerungen-Review)

- **Rate-Limiter umgehbar, solange der Server direkt erreichbar ist:**
  `getClientKey` vertraut dem `cf-connecting-ip`-Header, den aber auch
  ein direkter Request an den Server (ohne über Cloudflare zu laufen)
  frei setzen kann — ein Angreifer kann das Limit so beliebig umgehen.
  Betrifft vor allem das offene, kennwortlose Gästebuch, dessen einzige
  Spam-Bremse der Rate-Limiter ist. Muss vor dem Freigeben der Seite für
  echten Internet-Traffic behoben sein: entweder den Server auf
  Cloudflare-IP-Bereiche beschränken (Firewall), oder Caddy so
  konfigurieren, dass es `cf-connecting-ip` von Nicht-Cloudflare-Quellen
  verwirft/überschreibt (`trusted_proxies`, aktuell nur ein
  TODO-Kommentar im Caddyfile).

## Gefunden im Feingranulare-Schreib-Sperre-Review (nicht blockierend)

- **Feature-Namen (`guestbook`/`memories`/`who_votes`) können ohne
  Testausfall voneinander abweichen:** `z.enum` in
  `api/admin/write-lock/route.ts` und die drei Durchsetzungs-Routen
  teilen sich keinen gemeinsamen Typ, der das erzwingt. Ein Test, der
  über alle drei Features loopt (statt nur `guestbook` zu prüfen),
  würde das abfangen. Empfehlung: `FEATURES` als `as const`-Array
  definieren und `z.enum(FEATURES)` darauf aufbauen.
- **Kein Test für „Wer-von-uns-Ergebnisse lesen funktioniert trotz
  aktiver Sperre"** (Review-Vorgabe aus dem Plan, im Code korrekt
  erfüllt — `GET /api/who-votes` prüft die Sperre nicht —, aber nie
  durch einen Test belegt).
- **Seltene Wettlaufsituation im Dashboard:** Tippt die Admin-Person
  zwei Schalter kurz hintereinander an, bevor die erste Server-Antwort
  da ist, kann eine spät eintreffende Antwort kurzzeitig den falschen
  Schalter-Zustand anzeigen. Nur Anzeigesache (ein Reload korrigiert
  es), betrifft nur die eine Admin-Person.

## Gefunden im Galerie-Upload-Review (zurückgestellt, nicht blockierend)

- **Upload-Formular ohne Vorschaukacheln:** Die Statusliste zeigt nur
  Dateinamen (Spec §5 sieht Vorschaubilder vor); die Dateiauswahl ist ein
  ungestyltes natives Feld, die Karte hat kein Icon/keine Überschrift wie
  das Erinnerungen-Formular.
- **Kein Timeout/Abbrechen:** Ein hängender R2-PUT dreht, bis das Netz einen
  Fehler meldet; der Button bleibt so lange gesperrt.
- **Abgelaufenes Admin-Cookie (12 h):** Das Admin-Formular zeigt dann
  „Falsches Kennwort.", obwohl es kein Kennwortfeld hat.
- **Kennwort-Modus: doppelte Eingabe:** Gäste tippen das Kennwort einmal zum
  Entsperren und noch einmal zum Hochladen. Bräuchte eine Backend-Änderung
  (gültige Galerie-Sitzung als Upload-Berechtigung).
- **Thumbnail-PUT ohne Größenlimit in der Signatur:** Die Größe steht erst
  nach der Kompression im Browser fest; `/complete` prüft ≤ 2 MB, größere
  Dateien bleiben als Waisen in R2. Option: Vorschau vor der Ticket-Anfrage
  erzeugen und `thumbSize` mitsignieren.
- **Verwaiste R2-Objekte** bei abgebrochenen Uploads (Tab geschlossen, Netz
  weg): kein Aufräum-Job. Beim Export nach der Hochzeit mit aufräumen oder
  per Lifecycle-Regel.
- **Kein Schutz gegen Massen-Uploads mit gültigem Kennwort:** Der
  Upload-Rate-Limiter zählt nur noch Fehlversuche (sonst sperrt er das
  gemeinsame Veranstaltungs-WLAN). Kostenobergrenze stattdessen über ein
  Billing-Alarm in Cloudflare setzen.
- **Admin-Dashboard wird lang:** Galerie steht unter den kompletten
  Gästebuch-/Erinnerungen-Listen. Einklappbare Abschnitte oder Sprungmarken;
  Modus-Buttons nur ca. 28 px hoch; Vorschaubilder nicht vergrößerbar.
- **Eingabefelder mit 14 px:** iOS zoomt beim Fokus hinein (seitenweit).
- **Echtgeräte-Test steht aus:** iPhone-Safari (HEIC→JPEG bei
  `accept="image/*"`, Speicher bei 20+ Fotos, Tab im Hintergrund),
  Android-Chrome (HEIC ohne MIME-Typ), langsames WLAN.

## Offene externe Abhängigkeiten (aus der Spec)

- R2/Cloudflare-Zugangsdaten für die Foto-Pipeline (Galerie-Plan)
- TLS/Domain-Entscheidung
- Git-Push-Zugriff auf `kowrithv/saru_vinith_wedding` (`hartingsdev`
  bekommt aktuell 403)

## Noch zu planende Subsysteme (Backlog aus der Spec)

- Foto-Teil von Erinnerungen über die R2-Pipeline (im
  Gästebuch/Erinnerungen-Plan bewusst ausgeklammert, `photo_key` bleibt
  bis dahin immer `null`). Die Galerie selbst (Backend, Ansicht, Upload,
  Admin-Modus-Schalter und Lösch-Liste) ist gebaut und mit Mocks getestet;
  echte R2-Zugangsdaten stehen noch aus (siehe oben).
- Betriebs-Härtung: SQLite-Backup-Cron, Festplatten-Alarm (Spec: stündlich
  `VACUUM INTO`, rotierend, plus eine Kopie off-box; Disk-Alarm bei 85%).
  Braucht noch vom Nutzer: Ziel für die Off-Box-Kopie (z. B. ein zweiter
  Server per rsync/SSH, oder ein Objekt-Storage-Bucket) und einen
  Alarm-Kanal (z. B. Discord-/Slack-Webhook, E-Mail) — ohne das lässt
  sich nur die lokale Rotation bauen, nicht die eigentliche Absicherung.
