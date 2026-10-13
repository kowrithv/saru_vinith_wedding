# TODO

## Inhalte vor dem Freeze (von euch)

- **Programm auf `/info` hat drei Zeilen mit „TBA":** Sektempfang &
  Gratulationen, Gemeinsames Abendessen, Party & Tanz
  (`receptionSchedule` in `src/lib/event-info.ts`). Uhrzeiten eintragen
  oder die Zeilen entfernen — „TBA" sollte am Hochzeitstag nicht stehen.

## Gefunden im Feingranulare-Schreib-Sperre-Review (nicht blockierend)

- **Seltene Wettlaufsituation im Dashboard:** Tippt die Admin-Person
  zwei Schalter kurz hintereinander an, bevor die erste Server-Antwort
  da ist, kann eine spät eintreffende Antwort kurzzeitig den falschen
  Schalter-Zustand anzeigen. Nur Anzeigesache (ein Reload korrigiert
  es), betrifft nur die eine Admin-Person.

## Gefunden im Galerie-Upload-Review (zurückgestellt, nicht blockierend)

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
- **Echtgeräte-Test steht aus:** iPhone-Safari (HEIC→JPEG bei
  `accept="image/*"`, Speicher bei 20+ Fotos, Tab im Hintergrund),
  Android-Chrome (HEIC ohne MIME-Typ), langsames WLAN.

## Gefunden im Homepage-Review (zurückgestellt, nicht blockierend)

- **Lange Startseite auf dem Handy:** 7 Kacheln ≈ 1.750 px. Kompakte
  Zeilen (Icon + Titel) unterhalb von `sm` würden es halbieren.
- Der Plan `2026-10-12-homepage.md` nennt noch 8 Kacheln und die
  Galerie-Ausnahme (historisch, nicht mehr gültig).

## Gefunden im Ops-/Polish-Review (zurückgestellt, nicht blockierend)

- **Abbrechen-Knopf verliert den Fokus** beim Ausblenden (Tastatur/VoiceOver).
- **Schwebender Knopf kann „Abbrechen" überdecken:** „Schließen" blendet das
  Formular nur aus (Uploads laufen weiter), „Abbrechen" stoppt sie; auf kleinen
  Bildschirmen liegt der schwebende Knopf über dem unteren Formularrand.
- **Vorschau-Speicher:** jede Kachel hält das 800-px-Thumbnail (ca. 2 MB
  Bitmap) für eine 40-px-Kachel; bei 20 Fotos ca. 40 MB.
- **Test-Lücken:** Integritätsprüfung mit Zeilen ungleich `ok`, `unref()`,
  `greetingTimeout`, Log-only-Cool-down, der `NEXT_RUNTIME`-Zweig und der
  Catch um den dynamischen Import sind nicht von Tests abgedeckt; der
  Galerie-Test „keeps the upload flag" kann nicht fehlschlagen (Flag ist dort
  `false`).
- **Neustart-Schleife:** läuft der Prozess schneller ab, als SMTP fertig
  wird, kommt gar keine Mail — nur ein externer Uptime-Monitor fängt das.

## Memory-Rekord aller Gäste (umgesetzt) — Restrisiken und zurückgestellt

- **Gefälschter Rekord ist nicht verhinderbar:** Ohne Namen und ohne
  serverseitig gespieltes Spiel kann ein Skript mit einer Anfrage „8 Züge ·
  00:04" eintragen; dieser Wert ist praktisch unschlagbar. Die Grenzen im
  Server halten nur absurde Werte ab. Gegenmittel: Der Admin sieht den
  aktuellen Rekord in seiner Karte und kann ihn mit einem Tipp zurücksetzen.
  Echte Abhilfe wäre ein vom Server verteiltes Spiel — für diesen Termin zu groß.
- **Zeit zählt ab dem Laden der Seite, nicht ab dem ersten Tipp.** Bei gleich
  vielen Zügen entscheidet die Zeit und enthält so auch die Lesezeit. Für die
  persönliche Bestzeit egal, für den gemeinsamen Rekord unfair; der Zähler
  müsste beim ersten Aufdecken starten (ändert das bestehende Spiel).
- **Wortwahl:** „Deine Bestzeit" und „Rekord aller Gäste" ranken beide nach
  Zügen zuerst. Nach einem Zurücksetzen kann die eigene Bestzeit besser
  aussehen als der Rekord.
- **Rate-Limiter-Map** wird nie geleert (gilt für alle Limiter, vorbestehend).

## Offene externe Abhängigkeiten (aus der Spec)

- R2/Cloudflare-Zugangsdaten für die Foto-Pipeline (Galerie-Plan)
- Domain `vsjourney.de`: Registrierung und DNS liegen bei netcup. Für die
  R2-Custom-Domain (`fotos.vsjourney.de`) muss die DNS-Zone zu Cloudflare
  umziehen (Free-Plan: nur Full Setup) — Schritte in
  `docs/ops/cloudflare-r2-setup.md`. Nameserver-TTL 24 h: vor Mittwoch erledigen.
- TLS/Proxy: Auf dem Server terminiert **Traefik** TLS. Die
  `docker-compose.yml` im Repo ist die Traefik-Variante; Netzwerkname,
  Entrypoint und Cert-Resolver müssen zum vorhandenen Traefik passen. Vor dem
  Umstieg: alte Seite stoppen und alte Route entfernen (README „Umstieg von
  der alten Seite"); am Entrypoint darf `forwardedHeaders.insecure` nicht
  gesetzt sein, sonst lässt sich der Rate-Limiter per Header umgehen.

## Noch zu planende Subsysteme (Backlog aus der Spec)

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
