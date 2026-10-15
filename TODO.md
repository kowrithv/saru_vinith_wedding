# TODO

Nur Offenes, Stand Do 15.10.2026 abends. **(?)** = braucht eine Antwort.
Dauerhafte Hinweise und Grenzen stehen in der README („Bekannte Grenzen").

## Brautpaar

1. **Optimeye = Fotografie (?)**: bestätigen oder ändern (`src/lib/vendors.ts`).
2. **„Wer von uns?" (zurückgestellt)**: eigene Seite, vorab abstimmen ohne Ergebnis,
   Auflösung später durch den Admin freigegeben. Offen: DJ-Zugriff auf die Ergebnisse
   (Vorschlag: eigener Lese-Link nur für die Ergebnisse) und ob mehrfaches Abstimmen
   erlaubt ist.
3. **Videos (zurückgestellt)**: heute nur Fotos mit Hinweis am Auswahlfeld. Empfehlung
   bleibt: nur Fotos, bis der Tag vorbei ist.
4. **Optional, bleibt so**: Fotos je Meilenstein der Geschichte (`photo` in
   `src/lib/story-content.ts`), Texte für „Gut zu wissen" (`goodToKnow` in
   `src/lib/event-info.ts`), Porträts für „Wer von uns?".

## Betreiber: Server und Test (vor dem Freeze)

1. Pushen: `develop`, dann `develop:main`, Tag `v1.0.0-rc.1`.
2. `.env.production`: `GUEST_PASSWORD=love`; `UPLOAD_PASSWORD_EMPFANG` raus (auch aus
   `.env.local`); `R2_*` und `R2_JURISDICTION`; **`R2_ENDPOINT` darf nicht gesetzt
   sein**; dann `up -d --force-recreate web`.
3. Bucket-CORS: Produktionsdomain; `localhost` nach den Tests entfernen.
4. Voraussetzungen bestätigen: Foto-Domain und DNS erledigt
   (`docs/ops/cloudflare-r2-setup.md`), `caddy version` ≥ 2.5 (sonst lässt sich der
   Rate-Limiter per Header umgehen).
5. **Gerätetest** nach `docs/ops/geraetetest-checkliste.md` auf iPhone und Android,
   besonders: QR-Scan, Foto-Upload (HEIC, 20+ Fotos, Tab im Hintergrund, langsames WLAN),
   Erinnerung mit Foto, Polaroid speichern (Teilen-Menü), Memory-Spiel, Zustände mit
   `?zeit=…`.
6. Smoke- und Lasttest gegen die echte Domain.
7. Betrieb: SMTP-Zugang (`SMTP_*`, `ALERT_EMAIL_TO`), Ziel für die Off-Box-Kopie (zweiter
   Server per rsync/SSH oder privater Bucket, **nicht** der Foto-Bucket), Uptime-Monitor auf
   `/api/health` (fängt auch eine Neustart-Schleife, die keine Mail mehr schafft),
   Billing-Alarm in Cloudflare. Einrichtung: `docs/ops/hochzeitstag-runbook.md` §7.
8. Tag `v1.0.0` (`IMAGE_TAG=1.0.0`) und **Freeze**.
9. Samstag: `docs/ops/hochzeitstag-runbook.md`.

## Claude

- Unabhängiges Code-Review aller Änderungen (frische Sicht; die eigene Durchsicht der
  letzten Commits ist gemacht).
- Admin-Bereich und die Seiten in Desktop-Breite im Browser ansehen.
- Funde aus dem Gerätetest beheben; „Wer von uns?" umbauen, sobald es wieder dran ist.

## Nach der Hochzeit und Backlog (nicht blockierend)

- Export der Originale (Runbook §6); **verwaiste R2-Objekte** (abgebrochene Uploads,
  Erinnerung nach dem Foto-Upload nicht abgesendet) aufräumen: per Skript mit Abgleich zur
  Datenbank oder per Lifecycle-Regel.
- Optional danach: Kennwort oder Galerie-Modus ändern.
- Nur falls der Gerätetest bei 20+ Fotos Probleme zeigt: **Vorschau-Speicher** (jede Kachel
  hält das 800-px-Thumbnail, bei 20 Fotos ca. 40 MB).
- Nicht umgesetzt aus den Entwürfen: roter Punkt für neue Fotos (bräuchte „zuletzt
  gesehen" je Gerät); Admin-Knopf „alles entfernen, was mindestens so gut ist" und „Mehr
  anzeigen" über die besten 50 beim Memory-Rekord.
- Optional: `www.vsjourney.de` hat in der Caddyfile keinen Block.
