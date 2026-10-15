# TODO

Stand Do 15.10.2026 abends. Nur, was jetzt ansteht; Späteres steht in `docs/backlog.md`,
dauerhafte Hinweise in der README („Bekannte Grenzen").

Noch nicht feature complete: „Wer von uns?" fehlt (siehe unten).

## Brautpaar

- [ ] Entscheidungen für „Wer von uns?" als eigene Seite: DJ-Zugriff auf die Ergebnisse
      (Vorschlag: eigener Lese-Link mit langem Zufallsschlüssel) und mehrfaches Abstimmen
      (Einzelheiten im Backlog)
- [ ] Videos bleiben zurückgestellt (Empfehlung: erst nach der Feier)

## Claude

- [ ] „Wer von uns?" als eigene Seite bauen, sobald die Entscheidungen da sind (mit Limit je
      Gerät für die Stimmen)
- [ ] Admin und Desktop-Breite im Browser ansehen

## Betreiber, vor dem Tag

- [ ] Vorher `caddy version` ≥ 2.5 prüfen; dann `develop` pushen, `develop:main`, Tag
      `v1.0.0-rc.1` (README „Deployment")
- [ ] `.env.production`: `GUEST_PASSWORD=love` setzen, `UPLOAD_PASSWORD_EMPFANG` entfernen,
      `R2_ENDPOINT` **nicht** setzen; **neues `ADMIN_PASSWORD`** (das alte steht in der
      Git-Historie; ein Wechsel beendet alle Admin-Sitzungen); Bucket-CORS ohne `localhost`
- [ ] Caddy: Größe der Anfragen begrenzen (ein riesiger Body kann den Container-Speicher
      sprengen), z. B. `request_body { max_size 64KB }` im Block für `/api/*` (Uploads
      laufen direkt zu R2)
- [ ] Gerätetest auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`), danach
      Smoke- und Lasttest gegen die echte Domain
- [ ] Tag `v1.0.0` und Freeze

## Betreiber, nach dem Tag (vor Samstag)

- [ ] SMTP, Off-Box-Kopie, Uptime-Monitor, Billing-Alarm und der Cron für
      `scripts/ops/restart-if-unhealthy.sh` (`docs/ops/hochzeitstag-runbook.md` §7)
- [ ] GitHub-Issues #2 bis #6 schließen (alle gelöst, nur nicht als geschlossen markiert;
      Verweis auf die Commits 92a9e97 und b1b6f08)

## Nach der Hochzeit

- [ ] Originale exportieren und verwaiste R2-Objekte aufräumen (Runbook §6)
