# TODO

## Offene Punkte – gemeinsame Liste (Stand Do 15.10. abends)

Zuerst eure Liste (RHA) mit meinen Anmerkungen, danach unter „Sachen von
Claude" alles, was ich sonst gefunden habe. Entscheidungen sind mit **(?)**
markiert.

### Eure Punkte

**1. Erinnerungen: Polaroid mit Datum und Anlass, Blumendeko (Beispiel von Vinith)**
- **Erledigt, ohne Blumen** (entschieden am 15.10.): hochkant auf cremeweißem Papier mit
  runden Ecken, Foto, darunter „STANDESAMTLICHE HOCHZEIT", „Saruga & Vinith" in
  Schreibschrift, „17.10.2026" und Linie–Herz–Linie; der Gast steht in einer kleinen
  Zeile („Erinnerung von Lena"). Auf der Seite und im gespeicherten PNG gleich; am Handy
  über das Teilen-Menü (in die Fotos), am Computer als Download.
- Ungeprüft: das Teilen-Menü auf einem echten iPhone und Android.

**2. „Wer von uns?": eigene Seite, vorab abstimmen, Auflösung später, DJ-Zugriff**
- Heute: Umschalter im Quiz (`/quiz`), die Balken erscheinen sofort nach der Stimme.
- Umbau: Seite `/wer-von-uns` mit eigener Navigation und Kachel; alle Fragen auf einmal;
  **ohne Ergebnis** für Gäste; die Ergebnisse sieht nur der Admin und ein **Schalter
  „Ergebnis freigeben"** schaltet sie für alle frei (in der Konfiguration wie die
  Schreib-Sperren). Smoke-Skript und Navigation müssen die Seite kennen.
- **(?) DJ-Zugriff:** der DJ soll die Ergebnisse vorab sehen, aber nicht den
  Admin-Zugang bekommen. Vorschlag: ein eigener Lese-Link mit langem Zufallsschlüssel
  nur für die Ergebnisse (kein Schreiben, kein Löschen), den ihr dem DJ schickt.
- Offen: ob eine Person mehrfach abstimmen darf (heute je Gerät, nicht erzwingbar)
  und die Porträtfotos (S/V) statt der Buchstaben-Marken.

**3. Passwort → QR-Code → Vinith (Flyer)**
- Kennwort **love** (ohne Groß-/Kleinschreibung). QR-Dateien in
  `/home/hartings/hochzeit-qr/` (SVG und PNG, schwarz und dunkelblau, Text für Vinith).
- Offen bei euch: Dateien an Vinith schicken; `GUEST_PASSWORD=love` in
  `.env.production` setzen und `up -d --force-recreate web`; mit dem Handy gegen die
  echte Domain scannen; Probedruck prüfen. Der Code zeigt auf `vsjourney.de`.

**4. Startseite: Bild austauschen**
- `public/hero/paar.jpg` ist ein Platzhalter (ein Memory-Foto, 450 × 800, identisch
  mit `memory-1.jpg`). Gebraucht: Hochformat ab 900 × 1100 px, unter 200 KB, Gesichter
  im oberen Drittel (der Rahmen ist oben rund). Datei ersetzen, nichts sonst.

**5. „Unsere Fotos" auf der Startseite: vier kleine Bilder**
- Heute vier Farbflächen (`PREVIEW_SWATCHES` in `FeatureGrid.tsx`). Gebraucht: vier
  quadratische Bilder, 120 × 120 px, je ca. 5–10 KB, in `public/home/`. Nicht aus der
  Galerie nehmen: sie ist kennwortgeschützt, die Startseite ist öffentlich.

**6. Deployment**
- Reihenfolge: `develop` pushen → `develop:main` → Tag `v1.0.0-rc.1`; Server:
  `.env.production` (Pflicht-Variablen, `GUEST_PASSWORD`, R2, `R2_JURISDICTION`),
  `IMAGE_TAG`, Caddy; danach Gerätetest, Smoke- und Lasttest gegen die Domain,
  Bucket-CORS ohne `localhost`, endgültiges `v1.0.0`.
- Seit dem letzten Gerätetest hat sich viel geändert (Gestaltung, Upload-Kategorien,
  Kennwort/Limit, `R2_ENDPOINT`): **neuen rc bauen und die Checkliste noch einmal
  durchgehen**, bevor `v1.0.0` getaggt wird.
- `R2_ENDPOINT` darf in der Produktion nicht gesetzt sein; `.env.local` und
  `.env.production` brauchen `GUEST_PASSWORD` statt `UPLOAD_PASSWORD_EMPFANG`.

**7. Prüfen mit Videos**
- Stand: Videos werden nicht angenommen (nur JPEG, PNG, WebP, HEIC und HEIF bis 20 MB).
  **Neu:** Im Upload-Formular und bei den Erinnerungen steht jetzt „Nur Fotos, keine
  Videos." direkt am Auswahlfeld.
- **(?)** Falls Videos erlaubt sein sollen (größere Grenzen, andere Vorschau, mehr
  R2-Kosten): Empfehlung bleibt nur Fotos, bis der Tag vorbei ist.
- Falls „mit Videos prüfen" etwas anderes meint (Bildschirmvideos der Abläufe?),
  bitte kurz sagen.

**8. Memory: Bilder verkleinern**
- **Erledigt:** zehn Bilder 400 × 400 px, zusammen ca. 300 KB statt 748 KB (Gesichter
  bleiben im Ausschnitt). Mit Originalen von euch ließe es sich noch einmal sauberer
  machen (`scripts/compress-memory-images.mjs`).

**9. Dienstleister**
- **(?)** Unklar, was gemeint ist: eine Seite oder Zeile „Dienstleister" (Fotograf,
  DJ, Location, Caterer mit Link oder Namen), Zugang für sie (DJ-Ergebnisse, Kennwort,
  Upload) oder Absprachen? Bitte kurz beschreiben.

**10. Rate Limit besprechen**
- So ist es: Entsperren 20 Fehlversuche je Adresse und 15 Minuten (vorher 5); Gästebuch
  und Erinnerungen je 30 Anfragen in 15 Minuten, Upload zählt nur Fehlversuche; alles im
  Speicher des Servers (ein Neustart setzt zurück), Schlüssel ist die Adresse aus
  `X-Forwarded-For`.
- Folgen: ein erratbares Wort schützt nicht gegen gezieltes Raten (die Grenzen bremsen
  nur Automaten); verteilt auf Entsperren, Gästebuch, Erinnerungen und Upload sind es
  zusammen deutlich mehr als 20 Versuche je Adresse.
- **(?) Missbrauch mit gültigem Kennwort:** wer „love" kennt, kann unbegrenzt Fotos
  hochladen (Speicher- und Übertragungskosten in R2); es gibt nur den Notaus
  „Foto-Upload sperren" im Admin und einen Billing-Alarm (siehe unten). Vorschlag: eine
  Obergrenze je Adresse und Stunde (z. B. 200 Fotos).
- **(?)** Gemeinsame Adresse des Veranstaltungs-WLANs: 30 Gästebuch-Einträge in 15
  Minuten könnten bei 100 Gästen knapp werden; Zahlen anpassen oder nicht.
- Erledigt: Wird ein QR-Scan durch die Sperre abgewiesen, steht dort nicht mehr „QR-Code
  nicht mehr gültig", sondern die normale Kennwort-Eingabe (mit dem Hinweis, wie lange
  zu warten ist).

### Sachen von Claude

**Noch nicht gesehen oder getestet (ehrlich: nur Tests und HTML, kein Browser)**
- Alle Gestaltungsänderungen dieser Runde (Kacheln, Anfahrt, Großansicht, Filter,
  Quiz-Ergebnis, Memory-Band, Story-Karten) wurden nicht in einem echten Browser
  angesehen, nur per Test und Server-HTML geprüft.
- **Echter R2-Upload aus dem Browser** (CORS-PUT, Jurisdiktion `eu`): nur gegen den
  Ersatz-Server geprüft, nie gegen Cloudflare.
- **Polaroid herunterladen** auf iPhone und Android (Canvas, Schriften, Speichern).
- **HEIC vom iPhone** bei Browsern ohne HEIC-Dekodierung (die Vorschau entsteht im
  Browser): ungeprüft.
- Das **unabhängige Code-Review** über die Commits seit dem letzten Review ist nicht
  gelaufen.
- Die **Tageszustände** (vorher / heute / danach) sind getestet, aber nicht zur
  echten Uhrzeit am 17.10. beobachtet.
- `docs/ops/geraetetest-checkliste.md` ist mit den neuen Abläufen (QR-Scan,
  Standesamt/Party, Foto zur Erinnerung) noch nicht durchgespielt.

**Entscheidungen offen (?)**
- **Tageszustände:** „am Tag selbst" und „danach" lassen sich vorab ansehen:
  `/?zeit=heute`, `/?zeit=feier`, `/?zeit=danach` (ganze Seite, mit Band zum
  Beenden). Der Vergleichsmodus für die Zeit davor ist entfernt. Offen: eure
  Rückmeldung zu den drei Zuständen.
- **Programm bestätigen:** die zwei „Einzug"-Zeilen (17:15 mit Tortenanschneiden, ca.
  18:30 traditionell) und „ca. 20:00 – 21:00 Uhr" für das Abendessen.
- **Kategorien:** Gäste wählen jetzt *Standesamt* oder *Party*, der Admin zusätzlich
  *Kennenlernen* und *Verlobung*. Passt zum Beispiel („Standesamtliche Hochzeit"),
  bitte bestätigen; ebenso, dass der Admin die beiden Story-Kategorien behält.

**Inhalte, die noch fehlen**
- Hero-Foto (Punkt 4), vier Fotos auf der Kachel (Punkt 5), Fotos je Meilenstein in
  der Geschichte (`photo` in `story-content.ts`), „Gut zu wissen"-Texte
  (`goodToKnow` in `event-info.ts`), Porträts für „Wer von uns?".
- Aus den Vorschlägen nicht umgesetzt: der rote Punkt für neue Fotos (C9).

**Betrieb und Aufräumen**
- SMTP-Zugang für Alarm-Mails; Ziel für die Off-Box-Kopie und Uptime-Monitor
  (`hochzeitstag-runbook.md` §7); Billing-Alarm in Cloudflare als Kostenobergrenze.
- Export der Originale (Runbook §6) und **verwaiste R2-Objekte** nach der Hochzeit.
- Das Passwort schützt die Galerie-Seite und ihre Liste, **nicht die Datei-Adressen**
  auf der Foto-Domain (zufällige UUID-Pfade, nicht erratbar, aber wer eine Adresse
  hat, sieht das Foto).
- Eigene Fotos löschen geht nur auf dem Gerät des Uploads (Token im Browser); sonst
  über den Admin.

## Einplanung (Stand Do 15.10.2026)

| Wann | Wer | Was |
|---|---|---|
| Di 13.10. abends | Betreiber | Domain/R2/Server/Gerätetest/Stimmen-Import nach `docs/ops/heute-abend.md` |
| Do 15.10. | Brautleute | Ablauf des Tages ist eingetragen (Zeiten mit „ca."); bitte bestätigen: die zwei „Einzug"-Zeilen und das „?" nach 21 Uhr |
| bis Mi 14.10. | Betreiber | SMTP-Zugang in `.env.production`; Ziel für Off-Box-Kopie und Uptime-Monitor (`hochzeitstag-runbook.md` §7) |
| Mi 14.10. | Betreiber | Gerätetest auswerten; Funde melden |
| Mi 14.10. (nur falls nötig) | Entwicklung | **Vorschau-Speicher** (nur wenn der Gerätetest bei 20+ Fotos Probleme zeigt) |
| bis Do 15.10. | Betreiber | **Gäste-Kennwort** ist gewählt (ein einfaches Wort, bewusst nicht „sicher"; QR-Code liegt lokal bei Vinith für den Flyer): `GUEST_PASSWORD` in `.env.production` setzen, `up -d --force-recreate web`, echten Scan prüfen; Gerätetest „Zugang" |
| Di 13.10. abends bis Do | Betreiber | Vorab-Tags `v1.0.0-rc.1`, `-rc.2` … für Deploys und Tests (`IMAGE_TAG` in der `.env` anpassen) |
| Do 15.10. bis abends | Betreiber | letzter Smoke- und Lasttest gegen die echte Domain, endgültiger Tag `v1.0.0` (`IMAGE_TAG=1.0.0`), **Freeze** — danach keine Änderungen mehr |
| Sa 17.10. | Bereitschaft | `docs/ops/hochzeitstag-runbook.md` |
| ab So 18.10. | Entwicklung | Export der Originale aus R2 (Runbook §6); **verwaiste R2-Objekte** aufräumen (Skript, Abgleich mit der Datenbank) |

Nicht geplant: ein vom Server verteiltes Memory-Spiel (bewusst clientseitig).

## Inhalte vor dem Freeze (von euch)

- **Programm auf `/info`:** eingetragen (Stand 15.10., `receptionSchedule` in
  `src/lib/event-info.ts`). Offen: bestätigen, ob die beiden „Einzug"-Zeilen so
  gemeint sind und ob das Abendessen „ca. 20:00 – 21:00 Uhr" heißen soll.
- **SMTP-Zugang für die Alarm-Mails** (`SMTP_*`, `ALERT_EMAIL_TO` in
  `.env.production`): kommt vom Betreiber, nicht von den Brautleuten. Ohne ihn
  laufen Alarme nur ins Log. Werte nie ins Repo oder in ein Issue.

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
