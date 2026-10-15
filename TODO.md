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

- [ ] R2 laut `docs/ops/heute-abend.md` Schritt 1–3 (Bucket, Foto-Domain, Purge-Token,
      Budget-Alarm), falls noch nicht geschehen
- [ ] Der Image-Build von `v1.0.0-rc.1` ist gescheitert (`npm ci` im Docker-Build wollte
      `better-sqlite3` kompilieren; behoben mit `--ignore-scripts` im `Dockerfile`). Ein Tag
      lässt sich nicht erneut verwenden: `develop` pushen, nach `main` mergen und
      **`v1.0.0-rc.2`** auf den Kopf von `main` setzen. Im Actions-Lauf muss der Job „Build
      and push Docker image" grün sein und unter „Extract metadata" `1.0.0-rc.2` stehen.
      Caddy ist v2.8.4 und damit neu genug; nur in der Caddyfile darf kein
      `trusted_proxies` stehen
- [ ] `.env.production`: `GUEST_PASSWORD=love` setzen, `UPLOAD_PASSWORD_EMPFANG` entfernen,
      `R2_ENDPOINT` **nicht** setzen; **neues `ADMIN_PASSWORD`** (das alte steht in der
      Git-Historie; ein Wechsel beendet alle Admin-Sitzungen); Bucket-CORS ohne `localhost`
- [ ] Caddy: Größe der Anfragen begrenzen (ein riesiger Body kann den Container-Speicher
      sprengen), z. B. `request_body { max_size 64KB }` im Block für `/api/*` (Uploads
      laufen direkt zu R2)
- [ ] Server auf die neue Seite umstellen (README „Umstieg von der alten Seite",
      `docs/ops/heute-abend.md` Schritt 5), danach die alten Quiz-Stimmen übernehmen
      (Schritt 8, mit `--password=<Gäste-Kennwort>`)
- [ ] Gerätetest auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`), danach
      Smoke-Test gegen die echte Domain (der Lasttest schreibt Stimmen und läuft nur lokal)
- [ ] Tag `v1.0.0` und Freeze

## Betreiber, nach dem Tag (vor Samstag)

- [ ] SMTP, Off-Box-Kopie, Uptime-Monitor, Billing-Alarm und der Cron für
      `scripts/ops/restart-if-unhealthy.sh` (`docs/ops/hochzeitstag-runbook.md` §7)
- [ ] GitHub-Issues #2 bis #6 schließen (alle gelöst, nur nicht als geschlossen markiert;
      Verweis auf die Commits 92a9e97 und b1b6f08)

## Nach der Hochzeit

- [ ] CI: `ubuntu-latest` zeigt ab dem 19.10.2026 auf Ubuntu 26; auf `ubuntu-24.04` festsetzen
      und die Aktionen anheben (`actions/checkout` läuft noch auf Node 20). **Das endgültige
      `v1.0.0` deshalb vor dem 19.10. bauen**
- [ ] Originale exportieren und verwaiste R2-Objekte aufräumen (Runbook §6)
