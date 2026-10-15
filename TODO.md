# TODO

Stand Do 15.10.2026 abends. Nur, was jetzt ansteht; Späteres steht in `docs/backlog.md`,
dauerhafte Hinweise in der README („Bekannte Grenzen").

Feature complete. Zurückgestellt: Videos.

## Brautpaar

- [ ] Videos bleiben zurückgestellt (Empfehlung: erst nach der Feier)

## Claude

- [ ] Desktop-Breite von Geschichte, Info, Galerie, Gästebuch und Erinnerungen sowie die
      Listen im Admin (Gästebuch, Erinnerungen, Galerie, Memory-Ergebnisse) im Browser
      ansehen; Startseite, Navigation, „Wer von uns?" und der obere Admin sind gesehen

## Betreiber, vor dem Tag

- [ ] `develop` pushen, `develop:main`, Tag `v1.0.0-rc.1` (README „Deployment"). Caddy ist
      v2.8.4 und damit neu genug; nur in der Caddyfile darf kein `trusted_proxies` stehen
- [ ] `.env.production`: `GUEST_PASSWORD=love` setzen, `UPLOAD_PASSWORD_EMPFANG` entfernen,
      `R2_ENDPOINT` **nicht** setzen; **neues `ADMIN_PASSWORD`** (das alte steht in der
      Git-Historie; ein Wechsel beendet alle Admin-Sitzungen); Bucket-CORS ohne `localhost`
- [ ] Caddy: Größe der Anfragen begrenzen (ein riesiger Body kann den Container-Speicher
      sprengen), z. B. `request_body { max_size 64KB }` im Block für `/api/*` (Uploads
      laufen direkt zu R2)
- [ ] Gerätetest auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`), danach
      Smoke-Test gegen die echte Domain (der Lasttest schreibt Stimmen und läuft nur lokal)
- [ ] Tag `v1.0.0` und Freeze

## Betreiber, nach dem Tag (vor Samstag)

- [ ] SMTP, Off-Box-Kopie, Uptime-Monitor, Billing-Alarm und der Cron für
      `scripts/ops/restart-if-unhealthy.sh` (`docs/ops/hochzeitstag-runbook.md` §7)
- [ ] GitHub-Issues #2 bis #6 schließen (alle gelöst, nur nicht als geschlossen markiert;
      Verweis auf die Commits 92a9e97 und b1b6f08)

## Nach der Hochzeit

- [ ] Originale exportieren und verwaiste R2-Objekte aufräumen (Runbook §6)
