# TODO

Stand Fr 16.10.2026, nachts. Nur offene Punkte, nach Dringlichkeit geordnet (bis Samstag, nach
der Hochzeit, später ohne Termin). Dauerhafte Hinweise stehen in der README („Bekannte
Grenzen").

## Vor Samstag (in dieser Reihenfolge)

- [ ] **`v1.0.0-rc.4` ausrollen** (Admin: „Alle Stimmen löschen" für „Wer von uns?"):
      `develop` pushen, nach `main` mergen, Tag `v1.0.0-rc.4` auf den Kopf von `main`, im
      Actions-Lauf alle Jobs grün. Auf dem Server `IMAGE_TAG=1.0.0-rc.4` in der `.env`,
      `docker-compose pull`, `docker-compose up -d`, `ps` (healthy), dann
      `node scripts/smoke.mjs https://vsjourney.de`
- [ ] **Gerätetest** auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`), noch offen:
      QR-Code mit der Kamera, „Wer von uns?" mit Ändern und „Zurück", HEIC-Foto vom iPhone;
      Bucket-CORS ohne `localhost` prüfen
- [ ] **Tag `v1.0.0`** auf denselben Stand wie `rc.4`, **vor dem 19.10.**, danach Freeze
      (nichts mehr ändern)
- [ ] **Absicherung für den Tag selbst** (`docs/ops/hochzeitstag-runbook.md` §7): Uptime-Monitor
      (z. B. UptimeRobot), Kopie der Sicherung außer Haus (Ziel und Anbieter offen), Cron für
      `scripts/ops/restart-if-unhealthy.sh`, Billing-Alarm bei Cloudflare, optional SMTP
- [ ] **Vorschau-Speicher:** jede Galerie-Kachel hält das 800-px-Thumbnail (ca. 2 MB Bitmap),
      bei 20 Fotos ca. 40 MB. Nur angehen, falls der Gerätetest Probleme zeigt

## Nach der Hochzeit

- [ ] CI nach der Hochzeit: die `docker/*`-Aktionen (setup-buildx v3, login v3, metadata v5,
      build-push v6) auf die neuesten Versionen heben; sie laufen nur bei einem Tag und ließen
      sich vorher nicht ausprobieren
- [ ] Originale exportieren (Runbook §6)
- [ ] **Verwaiste R2-Objekte** aufräumen (abgebrochene Uploads, Erinnerung nach dem Foto-Upload
      nicht abgesendet): es gibt keinen Aufräum-Job; per Skript mit Abgleich zur Datenbank oder
      per Lifecycle-Regel (Runbook §6)

## Später, ohne Termin (nicht blockierend)

- [ ] **Videos:** werden nicht angenommen (nur JPEG, PNG, WebP, HEIC, HEIF bis 20 MB); am
      Auswahlfeld steht „Nur Fotos, keine Videos." Empfehlung: dabei bleiben, bis der Tag
      vorbei ist (größere Grenzen, andere Vorschau, mehr R2-Kosten)
