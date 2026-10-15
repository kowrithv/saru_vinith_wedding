# TODO

## Was zu tun ist (Stand Do 15.10. abends)

Alles Offene an einer Stelle, nach Zuständigkeit geordnet. **(?)** = braucht eine
Antwort. Erledigtes steht unten kurz zum Abhaken.

### A. Brautpaar: entscheiden

Entschieden am 15.10.: Programm, Tageszustände und Kategorien passen; „Wer von uns?"
und Videos sind zurückgestellt; das Rate-Limit zählt je Gerät statt je Adresse
(siehe README „Gäste-Zugang").

1. **Rate Limit:** erledigt (je Gerät, richtiges Kennwort nie abgewiesen). Offen nur,
   falls ihr andere Zahlen wollt (Gästebuch/Erinnerungen 20 je 15 Minuten, Fotos 300
   je Stunde, falsche Kennwörter 20 je 15 Minuten).
2. **Dienstleister:** auf `/info` erwähnt. Offen: die Rollen von Optimeye, MP Designs
   und Bubble BAS (`src/lib/vendors.ts`).
3. **Zurückgestellt:** „Wer von uns?" (eigene Seite, DJ-Zugriff) und Videos.

### B. Brautpaar und Vinith: liefern

1. Erledigt: Hero-Foto (`landing.jpeg`) und vier kleine Fotos auf der Kachel (aus dem
   Memory-Spiel); der Flyer ist fertig.
2. Optional (bleibt so): Fotos je Meilenstein der Geschichte, Texte für „Gut zu
   wissen", Porträts für „Wer von uns?".

### C. Betreiber: Server und Test (vor dem Freeze)

1. Pushen: `develop`, dann `develop:main`, Tag `v1.0.0-rc.1`.
2. `.env.production` prüfen: `GUEST_PASSWORD=love`; `UPLOAD_PASSWORD_EMPFANG` raus
   (auch aus `.env.local`); `R2_*` und `R2_JURISDICTION`; **`R2_ENDPOINT` darf nicht
   gesetzt sein**; dann `up -d --force-recreate web`.
3. Bucket-CORS: Produktionsdomain; `localhost` nach den Tests entfernen.
4. **Gerätetest** nach `docs/ops/geraetetest-checkliste.md` auf iPhone und Android:
   QR-Scan, Foto-Upload (auch HEIC), Erinnerung mit Foto, Polaroid speichern (Teilen-Menü),
   Memory-Spiel, Zustände mit `?zeit=…`.
5. Smoke- und Lasttest gegen die echte Domain.
6. Betrieb: SMTP-Zugang (`SMTP_*`, `ALERT_EMAIL_TO`), Ziel für die Off-Box-Kopie,
   Uptime-Monitor auf `/api/health`, Billing-Alarm in Cloudflare.
7. Caddy-Version prüfen (`caddy version` ≥ 2.5, sonst lässt sich der Rate-Limiter per
   Header umgehen); bestätigen, dass Foto-Domain und DNS (`docs/ops/cloudflare-r2-setup.md`)
   erledigt sind.
8. Tag `v1.0.0` (`IMAGE_TAG=1.0.0`) und **Freeze**.
9. Samstag: `docs/ops/hochzeitstag-runbook.md`.

### D. Claude

Sobald die Antworten da sind:
- „Wer von uns?" umbauen und Videos entscheiden, wenn sie nicht mehr zurückgestellt sind.
- Rollen der Dienstleister eintragen (`src/lib/vendors.ts`).
- Funde aus dem Gerätetest beheben.

Ohne Antwort möglich:
- Das **unabhängige Code-Review** der letzten Commits (steht aus).

### E. Nach der Hochzeit

- Export der Originale (Runbook §6); verwaiste R2-Objekte aufräumen.
- Optional: Galerie-Modus oder Kennwort ändern; der Zustand „Wir sind verheiratet!"
  schaltet sich selbst um.

### F. Gut zu wissen (kein Handlungsbedarf)

- Alle Gestaltungsänderungen sind per Test und Server-HTML geprüft, nicht in einem
  echten Browser; der echte R2-Upload nur gegen einen Ersatz-Server; das Teilen-Menü des
  Polaroids und HEIC auf echten Geräten sind ungeprüft.
- Das Kennwort schützt die Seite und die Liste, nicht die Datei-Adressen der Fotos
  (zufällige UUID-Pfade). Eigene Fotos löscht man nur auf dem Gerät des Uploads, sonst
  der Admin. Die Rate-Limiter leben im Speicher (Neustart setzt zurück).
- Nicht umgesetzt aus den Vorschlägen: roter Punkt für neue Fotos (C9).

### Erledigt (Stand 15.10.)

Hero A, Kacheln, Zeitleiste (Uhrzeit unter dem Titel), Anfahrt-Karte, Galerie-Filter und
Großansicht, Gästebuch rechts ausgerichtet, Quiz-Ergebnis, Memory-Rekord und -Rücken,
Story-Karten; Polaroid nach Vinith' Beispiel (ohne Blumen) mit Teilen-Menü; Programm
eingetragen; Kategorie „Standesamt"; Kennwort `love` ohne Groß-/Kleinschreibung, 20
Fehlversuche je 15 Minuten, QR-Dateien; Memory-Bilder verkleinert und vorgeladen; Hinweis
„Nur Fotos, keine Videos"; Vorschau der Zustände; lokaler R2-Ersatz.

## Gefunden im Galerie-Upload-Review (zurückgestellt, nicht blockierend)

- **Verwaiste R2-Objekte** bei abgebrochenen Uploads (Tab geschlossen, Netz
  weg, Erinnerung nach dem Foto-Upload nicht abgesendet): kein Aufräum-Job. Beim Export nach der Hochzeit mit aufräumen oder
  per Lifecycle-Regel.
- **Kein Schutz gegen Massen-Uploads mit gültigem Kennwort:** Der
  Upload-Rate-Limiter zählt nur noch Fehlversuche (sonst sperrt er das
  gemeinsame Veranstaltungs-WLAN). Kostenobergrenze stattdessen über ein
  Billing-Alarm in Cloudflare setzen.
- **Echtgeräte-Test steht aus:** iPhone-Safari (HEIC→JPEG bei
  `accept="image/*"`, Speicher bei 20+ Fotos, Tab im Hintergrund),
  Android-Chrome (HEIC ohne MIME-Typ), langsames WLAN.

## Gefunden im Ops-/Polish-Review (zurückgestellt, nicht blockierend)

- **Vorschau-Speicher:** jede Kachel hält das 800-px-Thumbnail (ca. 2 MB
  Bitmap) für eine 40-px-Kachel; bei 20 Fotos ca. 40 MB.
- **Neustart-Schleife:** läuft der Prozess schneller ab, als SMTP fertig
  wird, kommt gar keine Mail — nur ein externer Uptime-Monitor fängt das.

## Gestaltung (Stand 15.10., umgesetzt; offen sind eure Inhalte)

- **Hero-Foto:** `public/hero/paar.jpg` ist vorläufig ein Memory-Foto (450 x 800 px);
  ein größeres Original ersetzt die Datei.
- **Geschichte:** Fotos je Meilenstein fehlen noch (`photo` in
  `src/lib/story-content.ts`); ohne Foto bleibt die Karte Text.
- **„Gut zu wissen":** Texte fehlen (`goodToKnow` in `src/lib/event-info.ts`).
- **„Wer von uns?":** statt Porträts stehen Buchstaben-Marken (S, V); echte Fotos
  wären eine kleine Ergänzung.
- **Lokal:** `rm -rf .next`, wenn der Build `exactly one entry` meldet.

## Memory-Rekord (umgesetzt, Entscheidung 13.10.)

- Das Spiel bleibt clientseitig; wir vertrauen auf Fairness. Ein gefälschter
  Wert lässt sich nicht verhindern, aber im Admin einzeln entfernen (alle
  gemeldeten Ergebnisse werden ohne Namen gespeichert, Obergrenze 100.000).
- Wer das Skript-Fälschen ganz ausschließen will, bräuchte ein vom Server
  verteiltes Spiel — für diesen Termin bewusst nicht.
- Eine Flut gefälschter Bestwerte (über 100.000, rund 42 Stunden von einer
  Adresse) würde ehrliche Ergebnisse aus der Obergrenze verdrängen (nur die
  Historie geht verloren; der Rekord wäre ohnehin gefälscht). Dann hilft nur
  „Zurücksetzen". Ein Admin-Knopf „alles entfernen, was mindestens so gut ist"
  und ein „Mehr anzeigen" über die besten 50 hinaus wären mögliche Ergänzungen
  nach der Hochzeit.

## Offene externe Abhängigkeiten (aus der Spec)

- R2/Cloudflare-Zugangsdaten für die Foto-Pipeline (Galerie-Plan)
- Foto-Domain: Registrierung und DNS von `vsjourney.de` liegen bei netcup. Eine
  R2-Custom-Domain verlangt, dass die **ganze Zone** der Foto-Domain bei
  Cloudflare liegt (Free-Plan: nur Full Setup), im selben Konto wie der Bucket.
  Entweder eine Subdomain einer Domain nehmen, die schon bei Cloudflare liegt
  (Variante A, kein Umzug, `R2_PUBLIC_BASE_URL` und `CLOUDFLARE_ZONE_ID` zeigen
  dann auf diese Domain), oder `vsjourney.de` umziehen (Variante B, Nameserver-TTL
  24 h: vor Mittwoch erledigen) — Schritte in `docs/ops/cloudflare-r2-setup.md`.
- TLS/Proxy: Auf dem Server terminiert ein **Caddy auf dem Host** TLS und
  leitet `vsjourney.de` an `localhost:3000` (Stand 13.10., an der Caddyfile
  gesehen). Die `docker-compose.yml` im Repo veröffentlicht `127.0.0.1:3000`
  und übernimmt den Port der alten Seite; an Caddy ändert sich nichts. Ein
  Traefik-Container läuft dort ebenfalls (Ports 1800/1801), bedient aber diese
  Domain nicht; die Traefik-Variante liegt als `docker-compose.traefik.yml`
  bei. Zu prüfen: `caddy version` ≥ 2.5 (überschreibt fremde
  `X-Forwarded-For`-Header, solange keine `trusted_proxies` gesetzt sind),
  sonst ließe sich der Rate-Limiter per Header umgehen. Optional:
  `www.vsjourney.de` hat in der Caddyfile keinen Block.

## Noch zu planende Subsysteme (Backlog aus der Spec)

- Die Galerie (Backend, Ansicht, Upload, Admin-Modus-Schalter, Lösch-Liste)
  und der Foto-Teil der Erinnerungen sind gebaut und mit Mocks getestet; der
  Gerätetest mit echtem R2 steht aus (siehe oben).
- Betriebs-Härtung, Rest: Off-Box-Kopie der Sicherungen (die stündliche
  lokale Sicherung mit Rotation, der Disk-Alarm und die E-Mail-Alarme sind
  gebaut) und ein externer Uptime-Monitor auf `/api/health`. Die Einrichtung
  steht fertig in `docs/ops/hochzeitstag-runbook.md` Abschnitt 7; es fehlen
  nur ein Ziel für die Kopie (zweiter Server per rsync/SSH oder ein privater
  Objekt-Storage-Bucket, **nicht** der öffentliche Foto-Bucket) und ein
  Anbieter für den Monitor.
