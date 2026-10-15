# TODO

Stand Do 15.10.2026 abends. Nur, was jetzt ansteht; Späteres steht in `docs/backlog.md`,
dauerhafte Hinweise in der README („Bekannte Grenzen").

## Brautpaar

- [ ] Optimeye = Fotografie? (`src/lib/vendors.ts`)
- [ ] Zurückgestellt: „Wer von uns?" und Videos (Einzelheiten im Backlog)

## Betreiber, vor dem Freeze

- [ ] Vorher `caddy version` ≥ 2.5 prüfen; dann `develop` pushen, `develop:main`, Tag
      `v1.0.0-rc.1` (README „Deployment")
- [ ] `.env.production`: `GUEST_PASSWORD=love` setzen, `UPLOAD_PASSWORD_EMPFANG` entfernen,
      `R2_ENDPOINT` **nicht** setzen; Bucket-CORS ohne `localhost`
- [ ] Gerätetest auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`), danach
      Smoke- und Lasttest gegen die echte Domain
- [ ] SMTP, Off-Box-Kopie, Uptime-Monitor, Billing-Alarm (`docs/ops/hochzeitstag-runbook.md` §7)
- [ ] Tag `v1.0.0` und Freeze

## Claude

- [ ] Unabhängiges Review; Admin und Desktop-Breite im Browser ansehen

## Nach der Hochzeit

- [ ] Originale exportieren und verwaiste R2-Objekte aufräumen (Runbook §6)
