# Heute Abend (Di 13.10.): Domain, R2, Server, Gerätetest

Reihenfolge, weil jeder Schritt den vorigen braucht. Die Einzelheiten stehen in
den verlinkten Checklisten; diese Seite hält nur Reihenfolge und Abhängigkeiten.

| # | Schritt | Details | Braucht |
|---|---|---|---|
| 1 | **Foto-Domain festlegen.** Variante A: Subdomain einer Domain, die schon bei Cloudflare liegt – dann ist hier nichts zu tun. Variante B (`fotos.vsjourney.de`): DNS-Bestand sichern, Zone zu Cloudflare, Nameserver bei netcup umstellen | `cloudflare-r2-setup.md` „Welche Foto-Domain?", bei B §1–3 | – |
| 2 | R2-Bucket, Foto-Domain verbinden, Purge-Token (Zone-ID der **Foto-Domain**), Werte für `.env.production` | `cloudflare-r2-setup.md` §4–7 | Schritt 1 (Zone aktiv, im selben Konto wie der Bucket) |
| 3 | Kosten-Wächter (Budget-Alarm) | `cloudflare-r2-setup.md` §9 | Schritt 2 |
| 4 | **Image bauen lassen:** `develop` nach `main`, Vorab-Tag **`v1.0.0-rc.1`** pushen (Image `1.0.0-rc.1`) | `README.md` „Deployment" | Entscheidung, dass der Stand reif ist |
| 5 | **Server umstellen** (siehe unten) | `README.md` „Umstieg von der alten Seite" | Schritt 2 und 4 |
| 6 | Smoke-Test gegen die echte Domain | `node scripts/smoke.mjs https://vsjourney.de` | Schritt 5 |
| 7 | **Gerätetest** am echten Handy | `geraetetest-checkliste.md` | Schritt 2, 5 und 6 |
| 8 | **Alte Quiz-Stimmen übernehmen** | siehe unten | Schritt 5 (alte Seite gestoppt, neue läuft) |

## Was vor Schritt 5 feststehen muss

- **Das Image existiert erst nach Schritt 4.** Die CI baut nur für Tags
  `v*.*.*`, deren Commit auf `main` liegt; der Build dauert einige Minuten. Ohne
  Image kann `docker compose pull` nichts holen. Im Actions-Lauf unter „Extract
  metadata" steht, welche Image-Tags entstanden sind (erwartet `1.0.0-rc.1`).
- **Heute nur ein Vorab-Tag, kein `v1.0.0`:** Ein Tag lässt sich nicht erneut
  verwenden. Würde heute `v1.0.0` gesetzt, bräuchte jede Änderung bis Donnerstag
  `v1.0.1`. Deshalb: heute `v1.0.0-rc.1`, Korrekturen `v1.0.0-rc.2` usw., und
  **erst nach dem Freeze am Donnerstag das endgültige `v1.0.0`**. Bei jedem neuen
  Tag `IMAGE_TAG` in der `.env` auf dem Server anpassen, dann `pull` und
  `up -d`.
- **Nur bei Variante B braucht die DNS-Umstellung Zeit** (Nameserver-TTL bis
  24 h). Bis die Zone bei Cloudflare aktiv ist, geht Schritt 2 nicht; Schritt 5
  und 6 funktionieren aber auch vorher (mit der alten oder neuen
  Nameserver-Auflösung), sofern `vsjourney.de` schon auf den Server zeigt. Bei
  Variante A läuft Schritt 2 sofort.
- **`.env.production` ist vollständig** (`R2_*`, `ADMIN_PASSWORD`,
  `UPLOAD_PASSWORD_EMPFANG`; SMTP kommt, sobald die Werte da sind).
  `UPLOAD_PASSWORD_EMPFANG` ist das **Gäste-Kennwort**: kurz, merkbar, nur
  Buchstaben/Ziffern, **nicht** Namen/Datum/Ort (stehen auf der Seite); es steckt im QR-Link (README „Gäste-Zugang"). Danach
  einen QR-Code erzeugen und am Handy gegenprüfen.

## Schritt 5 im Einzelnen (Server, per SSH)

Die Seite ist nur so kurz offline wie nötig: erst alles vorbereiten, **dann**
stoppen.

1. Alten Zustand festhalten: Ordner der alten Seite (`~/saru_vinith_wedding`)
   und `docker compose ps` notieren – das ist der Rückweg. Die Caddy-Route
   (`vsjourney.de { reverse_proxy localhost:3000 }`) bleibt, wie sie ist.
2. **Neue Seite vorbereiten, während die alte noch läuft:** Neue
   `docker-compose.yml` in einen **anderen** Ordner legen (z. B.
   `~/hochzeit`), daneben `.env.production` und eine `.env` mit
   `IMAGE_TAG=1.0.0-rc.1`; `chmod 600 .env.production`. Dann
   `docker compose -f docker-compose.yml config --quiet` – muss ohne Ausgabe
   durchlaufen (braucht das Image nicht). **Nicht** ohne `--quiet`: die
   Ausgabe kann die Werte aus `.env.production` enthalten.
3. **Image holen, sobald der Build grün ist:** `docker compose -f
   docker-compose.yml pull`. Das stört die alte Seite nicht.
4. Alte Seite stoppen: `docker compose down` im alten Ordner. Das gibt Port 3000
   frei (die neue App nimmt denselben). **Ab hier ist die Seite offline**, bis
   die neue läuft.
5. **Die alten Stimmen jetzt sichern**, nach dem Stoppen, damit keine mehr
   hinzukommen: `cp <alter-ordner>/data/who-votes.json ~/who-votes-alt.json`
   (siehe Schritt 8; die Datei enthält Namen der Abstimmenden, nicht
   weitergeben).
6. `docker compose -f docker-compose.yml up -d` im neuen Ordner. An Caddy ist
   nichts zu ändern.
7. `docker compose -f docker-compose.yml ps` – Status **healthy**; `logs web`
   zeigt `[backup] ok`; `curl -sI http://127.0.0.1:3000/api/health` auf dem
   Server liefert 200, danach `https://vsjourney.de` im Browser.

**Rückweg:** `docker compose -f docker-compose.yml down` im neuen Ordner, dann
im alten Ordner `docker compose up -d` (Image `latest`). Caddy leitet
unverändert an Port 3000.

## Alte Quiz-Stimmen übernehmen (Schritt 8)

Gespeichert hat die alte Seite nur die Stimmen der „Wer von uns?"-Abstimmung
(`data/who-votes.json`); das klassische Quiz speichert nichts. Fragen und
Antworten sind in alt und neu gleich, deshalb lassen sich die Stimmen exakt
übernehmen. Namen werden dabei **nicht** mit übernommen.

Das Skript liegt im Repository, nicht auf dem Server: es läuft **auf dem Rechner
mit dem Repo-Checkout** (Node ab Version 20) und spricht die Seite über das
Internet an.

```bash
# 0. Datei vom Server holen (im Repo-Ordner):
scp <server>:~/who-votes-alt.json ./who-votes-alt.json
# 1. Probelauf (sendet nichts, zeigt nur, was übernommen würde):
node scripts/import-old-votes.mjs ./who-votes-alt.json https://vsjourney.de
# 2. Wirklich übernehmen:
node scripts/import-old-votes.mjs ./who-votes-alt.json https://vsjourney.de --apply
# 3. Die Kopie mit den Namen löschen (lokal und auf dem Server):
rm ./who-votes-alt.json && ssh <server> rm ~/who-votes-alt.json
```

Exit-Code 1 heißt: etwas wurde abgewiesen, ist fehlgeschlagen, oder Einträge der
Datei waren unbrauchbar (die Hinweise stehen darüber).

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
