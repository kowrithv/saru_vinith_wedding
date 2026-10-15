# TODO

Stand Do 15.10.2026 abends. Nur, was jetzt ansteht; Späteres steht in `docs/backlog.md`,
dauerhafte Hinweise in der README („Bekannte Grenzen").

Feature complete. Zurückgestellt: Videos.

## Brautpaar

- [ ] Nach dem Umstieg: den Link für den DJ im Admin der **echten** Seite („Wer von uns?")
      kopieren und ihm schicken (das Wort hängt am `ADMIN_SECRET` des Servers und weicht von
      der Demo ab). Am Abend: „Beendet", dann „Freigegeben"
- [ ] Videos bleiben zurückgestellt (Empfehlung: erst nach der Feier)

## Claude

- [ ] Desktop-Breite von Geschichte, Info, Galerie, Gästebuch und Erinnerungen sowie die
      Listen im Admin (Gästebuch, Erinnerungen, Galerie, Memory-Ergebnisse) im Browser
      ansehen; Startseite, Navigation, „Wer von uns?" und der obere Admin sind gesehen

## Betreiber, vor dem Tag

Erledigt (16.10., nachts): Image `v1.0.0-rc.2` gebaut (`rc.1` scheiterte an
`better-sqlite3` im Docker-Build, behoben mit `--ignore-scripts`); R2 und
`.env.production` gesetzt; Server auf `1.0.0-rc.2` umgestellt (gesund, Sicherung ok);
Caddy-Limit `request_body { max_size 64KB }` für `/api/*` (413 und 401 geprüft); Smoke-Test
gegen `https://vsjourney.de` grün (20 von 20).

- [ ] **`v1.0.0-rc.3`** (Galerie: großer Auswahl-Knopf, Upload-Kacheln mit Fortschritt, Neuladen
      alle 30 s, leere Filter weg): `develop` pushen, nach `main` mergen, Tag auf den Kopf von
      `main`, im Actions-Lauf alle Jobs grün; auf dem Server `IMAGE_TAG=1.0.0-rc.3` in der
      `.env`, `docker-compose pull`, `docker-compose up -d`; danach der Gerätetest auf diesem Stand
- [ ] Gerätetest auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`): vor allem
      Foto-Upload nach R2 (HEIC und Android), QR-Anmeldung, Polaroid speichern, „Wer von
      uns?" mit Ändern; Bucket-CORS ohne `localhost` prüfen
- [ ] Im Admin „Wer von uns?" auf „Abstimmen" lassen und den Link für den DJ kopieren
- [ ] Tag `v1.0.0` und Freeze (vor dem 19.10.)

## Betreiber, nach dem Tag (vor Samstag)

- [ ] SMTP, Off-Box-Kopie, Uptime-Monitor, Billing-Alarm und der Cron für
      `scripts/ops/restart-if-unhealthy.sh` (`docs/ops/hochzeitstag-runbook.md` §7)
- [ ] GitHub-Issues #2 bis #6 schließen (alle gelöst, nur nicht als geschlossen markiert;
      Verweis auf die Commits 92a9e97 und b1b6f08)

## Nach der Hochzeit

- [ ] Alte Quiz-Stimmen: `~/who-votes-alt.json` auf dem Server enthält Namen. Entweder
      mit `scripts/import-old-votes.mjs` übernehmen (nur solange „Abstimmen" aktiv ist) oder
      löschen
- [ ] `www.vsjourney.de` hat keinen DNS-Eintrag und keinen Caddy-Block; bei Bedarf A-Eintrag
      `www` auf die Server-IP, dann `redir https://vsjourney.de{uri} permanent`
- [ ] CI: `ubuntu-latest` zeigt ab dem 19.10.2026 auf Ubuntu 26; auf `ubuntu-24.04` festsetzen
      und die Aktionen anheben (`actions/checkout` läuft noch auf Node 20). **Das endgültige
      `v1.0.0` deshalb vor dem 19.10. bauen**
- [ ] Originale exportieren und verwaiste R2-Objekte aufräumen (Runbook §6)
