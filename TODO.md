# TODO

Stand Fr 16.10.2026, nachts. Nur offene Punkte; Späteres steht in `docs/backlog.md`,
dauerhafte Hinweise in der README („Bekannte Grenzen").

## Vor Samstag (in dieser Reihenfolge)

- [ ] **`v1.0.0-rc.4` ausrollen** (Admin: „Alle Stimmen löschen" für „Wer von uns?"):
      `develop` pushen, nach `main` mergen, Tag `v1.0.0-rc.4` auf den Kopf von `main`, im
      Actions-Lauf alle Jobs grün. Auf dem Server `IMAGE_TAG=1.0.0-rc.4` in der `.env`,
      `docker-compose pull`, `docker-compose up -d`, `ps` (healthy), dann
      `node scripts/smoke.mjs https://vsjourney.de`
- [ ] **Testdaten löschen** (Admin): „Wer von uns?" → „Alle Stimmen löschen" (das Test-Handy
      muss danach ohne Löschen der Browserdaten wieder bei Frage 1 beginnen); Gästebuch,
      Erinnerungen und Fotos über die Lösch-Knöpfe; Memory-Spiel „Rekord zurücksetzen"
- [ ] **„Wer von uns?" auf „Abstimmen" lassen** und den **Link für den DJ** kopieren und ihm
      schicken (Admin der echten Seite, Abschnitt „Wer von uns?"; er soll ihn vorher einmal
      öffnen). Am Abend: „Beendet", dann „Freigegeben"
- [ ] **Gerätetest** auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`), noch offen:
      QR-Code mit der Kamera, „Wer von uns?" mit Ändern und „Zurück", HEIC-Foto vom iPhone;
      Bucket-CORS ohne `localhost` prüfen
- [ ] **Tag `v1.0.0`** auf denselben Stand wie `rc.4`, **vor dem 19.10.**, danach Freeze
      (nichts mehr ändern)
- [ ] **Absicherung für den Tag selbst** (`docs/ops/hochzeitstag-runbook.md` §7): Uptime-Monitor
      (z. B. UptimeRobot), Kopie der Sicherung außer Haus (Ziel und Anbieter offen), Cron für
      `scripts/ops/restart-if-unhealthy.sh`, Billing-Alarm bei Cloudflare, optional SMTP
- [ ] GitHub-Issues #2 bis #6 schließen (gelöst, nur nicht markiert; Verweis auf die Commits
      `92a9e97` und `b1b6f08`)

## Bei Claude

- [ ] Desktop-Breite von Geschichte, Info, Galerie, Gästebuch und Erinnerungen sowie die
      Listen im Admin (Gästebuch, Erinnerungen, Galerie, Memory-Ergebnisse) im Browser
      ansehen; am besten vor `rc.4`, damit Funde noch in denselben Tag kommen

## Nach der Hochzeit

- [ ] Alte Quiz-Stimmen: `~/who-votes-alt.json` auf dem Server enthält Namen. Mit
      `scripts/import-old-votes.mjs` übernehmen (nur solange „Abstimmen" aktiv ist) oder
      löschen
- [ ] `www.vsjourney.de` hat keinen DNS-Eintrag und keinen Caddy-Block: A-Eintrag `www` auf die
      Server-IP, dann `redir https://vsjourney.de{uri} permanent`
- [ ] CI: `ubuntu-latest` zeigt ab dem 19.10.2026 auf Ubuntu 26; auf `ubuntu-24.04` festsetzen
      und die Aktionen anheben (`actions/checkout` läuft noch auf Node 20)
- [ ] Originale exportieren und verwaiste R2-Objekte aufräumen (Runbook §6)
- [ ] Videos (zurückgestellt; Einzelheiten im Backlog)
