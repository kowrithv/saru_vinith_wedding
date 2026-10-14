# TODO

## Einplanung (Stand Di 13.10.2026)

| Wann | Wer | Was |
|---|---|---|
| Di 13.10. abends | Betreiber | Domain/R2/Server/Gerätetest/Stimmen-Import nach `docs/ops/heute-abend.md` |
| bis Mi 14.10. abends | Brautleute | Uhrzeiten der drei „TBA"-Zeilen (Issue-Entwurf); wir tragen sie ein |
| bis Mi 14.10. | Betreiber | SMTP-Zugang in `.env.production`; Ziel für Off-Box-Kopie und Uptime-Monitor (`hochzeitstag-runbook.md` §7) |
| Mi 14.10. | Betreiber | Gerätetest auswerten; Funde melden |
| Mi 14.10. (nur falls nötig) | Entwicklung | **Vorschau-Speicher** (nur wenn der Gerätetest bei 20+ Fotos Probleme zeigt) |
| bis Do 15.10. | Betreiber | kurzes **Gäste-Kennwort** festlegen (`GUEST_PASSWORD`), **QR-Code lokal erzeugen** und für Empfang/Tischkarten drucken (README „Gäste-Zugang"); Gerätetest „Zugang" |
| Di 13.10. abends bis Do | Betreiber | Vorab-Tags `v1.0.0-rc.1`, `-rc.2` … für Deploys und Tests (`IMAGE_TAG` in der `.env` anpassen) |
| Do 15.10. bis abends | Betreiber | letzter Smoke- und Lasttest gegen die echte Domain, endgültiger Tag `v1.0.0` (`IMAGE_TAG=1.0.0`), **Freeze** — danach keine Änderungen mehr |
| Sa 17.10. | Bereitschaft | `docs/ops/hochzeitstag-runbook.md` |
| ab So 18.10. | Entwicklung | Export der Originale aus R2 (Runbook §6); **verwaiste R2-Objekte** aufräumen (Skript, Abgleich mit der Datenbank); **Thumbnail-Größenlimit** in der Signatur; Foto-Teil der Erinnerungen (beides vorgezogen: vor den Freeze) |

Nicht geplant: ein vom Server verteiltes Memory-Spiel (bewusst clientseitig).

## Inhalte vor dem Freeze (von euch)

- **Programm auf `/info` hat drei Zeilen mit „TBA":** Sektempfang &
  Gratulationen, Gemeinsames Abendessen, Party & Tanz
  (`receptionSchedule` in `src/lib/event-info.ts`). Uhrzeiten eintragen
  oder die Zeilen entfernen — „TBA" sollte am Hochzeitstag nicht stehen.
- **SMTP-Zugang für die Alarm-Mails** (`SMTP_*`, `ALERT_EMAIL_TO` in
  `.env.production`): kommt vom Betreiber, nicht von den Brautleuten. Ohne ihn
  laufen Alarme nur ins Log. Werte nie ins Repo oder in ein Issue.

## Gefunden im Galerie-Upload-Review (zurückgestellt, nicht blockierend)

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

## Gefunden im Ops-/Polish-Review (zurückgestellt, nicht blockierend)

- **Vorschau-Speicher:** jede Kachel hält das 800-px-Thumbnail (ca. 2 MB
  Bitmap) für eine 40-px-Kachel; bei 20 Fotos ca. 40 MB.
- **Neustart-Schleife:** läuft der Prozess schneller ab, als SMTP fertig
  wird, kommt gar keine Mail — nur ein externer Uptime-Monitor fängt das.

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

- Foto-Teil von Erinnerungen über die R2-Pipeline (im
  Gästebuch/Erinnerungen-Plan bewusst ausgeklammert, `photo_key` bleibt
  bis dahin immer `null`). Die Galerie selbst (Backend, Ansicht, Upload,
  Admin-Modus-Schalter und Lösch-Liste) ist gebaut und mit Mocks getestet;
  echte R2-Zugangsdaten stehen noch aus (siehe oben).
- Betriebs-Härtung, Rest: Off-Box-Kopie der Sicherungen (die stündliche
  lokale Sicherung mit Rotation, der Disk-Alarm und die E-Mail-Alarme sind
  gebaut) und ein externer Uptime-Monitor auf `/api/health`. Die Einrichtung
  steht fertig in `docs/ops/hochzeitstag-runbook.md` Abschnitt 7; es fehlen
  nur ein Ziel für die Kopie (zweiter Server per rsync/SSH oder ein privater
  Objekt-Storage-Bucket, **nicht** der öffentliche Foto-Bucket) und ein
  Anbieter für den Monitor.
