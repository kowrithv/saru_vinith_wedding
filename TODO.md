# TODO

## Inhalte vor dem Freeze (von euch)

- **Programm auf `/info` hat drei Zeilen mit „TBA":** Sektempfang &
  Gratulationen, Gemeinsames Abendessen, Party & Tanz
  (`receptionSchedule` in `src/lib/event-info.ts`). Uhrzeiten eintragen
  oder die Zeilen entfernen — „TBA" sollte am Hochzeitstag nicht stehen.

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

## Gefunden im Homepage-Review (zurückgestellt, nicht blockierend)

- **„Wir heiraten!"-Badge** im Hero bleibt auch am Hochzeitstag stehen:
  der Hero ist jetzt eine Server-Komponente und kennt die Uhrzeit nicht.
  Der Countdown darunter wechselt dagegen auf „Wir sind verheiratet!".
- **Weitere `text-gold`-Textstellen mit zu wenig Kontrast** außerhalb der
  Startseite: Hashtag im Footer und im Mobil-Menü, Zeit-Chips auf `/info`.
  Dort `text-gold-text` verwenden (Token existiert).
- **Reduced Motion** ist für die übrigen framer-motion-Seiten (Story u. a.)
  nicht berücksichtigt; ein `MotionConfig reducedMotion="user"` im Layout
  würde es global lösen.
- **Lange Startseite auf dem Handy:** 7 Kacheln ≈ 1.750 px. Kompakte
  Zeilen (Icon + Titel) unterhalb von `sm` würden es halbieren.
- **Link-Texte der Kacheln** sind alle „Mehr erfahren"; Aktionstexte je
  Kachel („Jetzt spielen", „Eintrag schreiben") wären klarer.
- **„Mehr entdecken" im Hero** sieht anklickbar aus, ist aber kein Anker.
- Der Plan `2026-10-12-homepage.md` nennt noch 8 Kacheln und die
  Galerie-Ausnahme (historisch, nicht mehr gültig).

## Offene externe Abhängigkeiten (aus der Spec)

- R2/Cloudflare-Zugangsdaten für die Foto-Pipeline (Galerie-Plan)
- TLS/Domain-Entscheidung

## Noch zu planende Subsysteme (Backlog aus der Spec)

- **Gästespiel „Liebes-Memory": Gesamt-Bestzeit speichern.** Heute steht die
  Bestzeit nur pro Gerät im `localStorage` (`memory-spiel-best` in
  `MemoryGame.tsx`, Züge + Sekunden). Gewünscht ist **eine gemeinsame
  Bestzeit über alle Gäste** — nur der Highscore, **ohne Namen und ohne
  Liste der Spiele**. Ansatz: ein Datensatz in `app_config` (oder eigene
  Mini-Tabelle) mit den besten Werten; `POST` meldet ein Ergebnis und
  aktualisiert nur, wenn es besser ist (atomar, damit gleichzeitige Spiele
  nichts überschreiben), `GET` liefert den Rekord; die Seite zeigt ihn
  neben der eigenen Bestzeit. Vergleichsregel wie lokal: erst weniger Züge,
  bei Gleichstand weniger Sekunden. Wertebereich serverseitig prüfen
  (keine negativen oder unmöglich kleinen Werte), Rate-Limiter wie beim
  Gästebuch. Eigene Spec/Plan nötig.
- Foto-Teil von Erinnerungen über die R2-Pipeline (im
  Gästebuch/Erinnerungen-Plan bewusst ausgeklammert, `photo_key` bleibt
  bis dahin immer `null`). Die Galerie selbst (Backend, Ansicht, Upload,
  Admin-Modus-Schalter und Lösch-Liste) ist gebaut und mit Mocks getestet;
  echte R2-Zugangsdaten stehen noch aus (siehe oben).
- Betriebs-Härtung, Rest: Off-Box-Kopie der Sicherungen (die stündliche
  lokale Sicherung mit Rotation, der Disk-Alarm und die E-Mail-Alarme sind
  gebaut) und ein externer Uptime-Monitor auf `/api/health`. Braucht vom
  Nutzer: ein Ziel für die Kopie (zweiter Server per rsync/SSH oder ein
  privater Objekt-Storage-Bucket) und einen Anbieter für den Monitor.
