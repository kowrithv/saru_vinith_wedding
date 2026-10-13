# Heute Abend (Di 13.10.): Domain, R2, Server, Gerätetest

Reihenfolge, weil jeder Schritt den vorigen braucht. Die Einzelheiten stehen in
den verlinkten Checklisten; diese Seite hält nur Reihenfolge und Abhängigkeiten.

| # | Schritt | Details | Braucht |
|---|---|---|---|
| 1 | DNS-Bestand sichern, Zone zu Cloudflare, Nameserver bei netcup umstellen | `cloudflare-r2-setup.md` §1–3 | – |
| 2 | R2-Bucket, Domain `fotos.vsjourney.de`, Cache-Purge, Werte für `.env.production` | `cloudflare-r2-setup.md` §4–7 | Schritt 1 (Zone aktiv) |
| 3 | Kosten-Wächter (Budget-Alarm) | `cloudflare-r2-setup.md` §9 | Schritt 2 |
| 4 | **Image bauen lassen:** `develop` nach `main`, Tag `v1.0.0` pushen | `README.md` „Deployment" | Entscheidung, dass der Stand reif ist |
| 5 | **Server umstellen** (siehe unten) | `README.md` „Umstieg von der alten Seite" | Schritt 2 und 4 |
| 6 | Smoke-Test gegen die echte Domain | `node scripts/smoke.mjs https://vsjourney.de` | Schritt 5 |
| 7 | **Gerätetest** am echten Handy | `geraetetest-checkliste.md` | Schritt 2, 5 und 6 |
| 8 | **Alte Quiz-Stimmen übernehmen** | siehe unten | Schritt 5 (alte Seite gestoppt, neue läuft) |

## Was vor Schritt 5 feststehen muss

- **Das Image `1.0.0` existiert erst nach Schritt 4.** Die CI baut nur für Tags
  `v*.*.*`, deren Commit auf `main` liegt; der Build dauert einige Minuten. Ohne
  Image kann `docker compose pull` nichts holen.
- **Die DNS-Umstellung braucht Zeit** (Nameserver-TTL bis 24 h). Bis die Zone
  bei Cloudflare aktiv ist, geht Schritt 2 nicht; Schritt 5 und 6 funktionieren
  aber auch vorher (mit der alten oder neuen Nameserver-Auflösung), sofern
  `vsjourney.de` schon auf den Server zeigt.
- **`.env.production` ist vollständig** (`R2_*`, `ADMIN_PASSWORD`,
  `UPLOAD_PASSWORD_EMPFANG`; SMTP kommt, sobald die Werte da sind).

## Schritt 5 im Einzelnen (Server, per SSH)

1. Alten Zustand sichern: Ordner und Compose-Datei der alten Seite notieren,
   ggf. `docker compose ps` und die alte Traefik-Route (File-Provider oder
   Labels) festhalten – das ist der Rückweg. **Die alten Stimmen kopieren:**
   `cp <alter-ordner>/data/who-votes.json ~/who-votes-alt.json` (siehe
   Schritt 8; die Datei enthält Namen der Abstimmenden, nicht weitergeben).
2. Alte Seite stoppen: `docker compose down` im alten Ordner. **Ab hier ist die
   alte Seite offline**, bis die neue läuft.
3. Alte Traefik-Route für `vsjourney.de` entfernen (zwei Router mit derselben
   Regel sind uneindeutig).
4. Neue `docker-compose.yml` in einen Ordner legen, daneben `.env.production`
   und eine `.env` mit `IMAGE_TAG=1.0.0` (plus ggf. `TRAEFIK_*`).
5. `docker compose -f docker-compose.yml config` – muss ohne Fehler durchlaufen.
6. `docker compose -f docker-compose.yml pull` und `up -d`.
7. `docker compose -f docker-compose.yml ps` – Status **healthy**; `logs web`
   zeigt `[backup] ok`.

**Rückweg:** `docker compose -f docker-compose.yml down`, dann die alte
Compose-Datei im alten Ordner wieder mit `up -d` starten und die alte
Traefik-Route zurückstellen.

## Alte Quiz-Stimmen übernehmen (Schritt 8)

Gespeichert hat die alte Seite nur die Stimmen der „Wer von uns?"-Abstimmung
(`data/who-votes.json`); das klassische Quiz speichert nichts. Fragen und
Antworten sind in alt und neu gleich, deshalb lassen sich die Stimmen exakt
übernehmen. Namen werden dabei **nicht** mit übernommen.

```bash
# 1. Probelauf (sendet nichts, zeigt nur, was übernommen würde):
node scripts/import-old-votes.mjs ~/who-votes-alt.json https://vsjourney.de
# 2. Wirklich übernehmen:
node scripts/import-old-votes.mjs ~/who-votes-alt.json https://vsjourney.de --apply
```

- Erst ausführen, **wenn die alte Seite gestoppt ist** (sonst kommen in der alten
  Datei noch Stimmen dazu) und die neue läuft.
- Ein zweiter Lauf legt nichts doppelt an; Wiederholen ist also gefahrlos.
- Ist „Wer von uns?" im Admin gesperrt, meldet das Skript „abgewiesen (HTTP 423)":
  kurz entsperren, importieren, wieder sperren.
- Danach auf der Seite „Quiz" prüfen, dass die Zähler stimmen.

## Gerätetest (Schritt 7)

`geraetetest-checkliste.md` abarbeiten, zusätzlich beim ersten Aufruf der
Startseite am Handy ansehen:

- Die sieben Kacheln sind jetzt **kompakte Zeilen** (Icon, Titel, Aktion, ohne
  Beschreibung). Bei Bedarf lässt sich das mit `git revert df5a1c5` zurücknehmen.
- Das Memory-Spiel startet die Zeit erst mit der **ersten aufgedeckten Karte**.

## Noch offen (nicht heute Abend)

- Uhrzeiten für die drei „TBA"-Zeilen auf `/info`: liegen bei den Brautleuten
  (Issue-Entwurf, `TODO.md`).
- SMTP-Zugang für die Alarm-Mails: kommt vom Betreiber, nicht von den
  Brautleuten (`TODO.md`).
- Ziel für die Off-Box-Kopie der Sicherungen und ein Uptime-Monitor:
  `hochzeitstag-runbook.md` Abschnitt 7.
