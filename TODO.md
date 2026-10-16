# TODO

Stand Fr 16.10.2026. Nur offene Punkte, nach Dringlichkeit geordnet (bis Samstag, nach
der Hochzeit, später ohne Termin). Dauerhafte Hinweise stehen in der README („Bekannte
Grenzen").

## Vor Samstag (in dieser Reihenfolge)

- [ ] **`v1.0.0-rc.5` ausrollen.** `rc.4` läuft schon (Smoke-Test am 16.10.: 20 von 20); `rc.5`
      bringt die Vorschau beim Auswählen, das × zum Entfernen einzelner Fotos, Party als
      Voreinstellung im Upload und neu die **Beamer-Anzeige** (`/beamer`) mit der Punkte-Steuerung
      (`/punkte`) für „Team Bride gegen Team Groom“. `develop` pushen (2 Commits fehlen auf dem Remote), nach `main`
      mergen, Tag `v1.0.0-rc.5` auf den Kopf von `main`, im Actions-Lauf alle Jobs grün (die
      neuen Aktionen `checkout@v6` und `setup-node@v6` haben schon den Lauf von `rc.4`
      bestanden). Auf dem Server `IMAGE_TAG=1.0.0-rc.5` in der `.env` und in `.env.production` ein eigenes
      Kennwort `SCORE_PASSWORD=…` für Beamer und Punkte (nicht Admin-/Gäste-Kennwort; ohne den Wert
      bleiben die beiden Seiten zu), `docker-compose pull`,
      `docker-compose up -d`, `ps` (healthy), dann `node scripts/smoke.mjs https://vsjourney.de`
- [ ] **Gerätetest** auf iPhone und Android (`docs/ops/geraetetest-checkliste.md`), gegen
      `rc.5`, noch offen: QR-Code mit der Kamera, „Wer von uns?“ mit Ändern und „Zurück“,
      HEIC-Foto vom iPhone, **Beamer und Punkte** (Abschnitt „Beamer und Punktestand“ der Checkliste:
      Anmelden, Handy tippt, Beamer folgt in unter einer Sekunde, Punkt unten links grün, also
      kommt der Strom durch Caddy), neue Upload-Kacheln (Vorschau, × entfernt ein Foto, Party
      vorausgewählt), Gästebuch live auf zwei Handys (neuer Eintrag erscheint ohne Neuladen);
      Bucket-CORS ohne `localhost` prüfen
- [ ] **Tag `v1.0.0`** auf genau den getesteten Stand (`rc.5` oder, falls der Gerätetest
      etwas ergibt, ein späterer `rc`), **vor dem 19.10.**, danach Freeze (nichts mehr
      ändern). Jede Änderung an der Seite braucht vorher einen neuen `rc` und einen neuen Test
- [ ] **Absicherung für den Tag selbst** (`docs/ops/hochzeitstag-runbook.md` §7): Uptime-Monitor
      (z. B. UptimeRobot), Kopie der Sicherung außer Haus (Ziel und Anbieter offen), Cron für
      `scripts/ops/restart-if-unhealthy.sh`, Billing-Alarm bei Cloudflare, optional SMTP
- [ ] **Große Galerie am iPhone prüfen** (1000+ Fotos sind am Festtag möglich): viele Fotos
      hochladen oder die Galerie lange scrollen und beobachten, ob das Handy hakt oder Safari
      die Seite neu lädt. Gemessen (Desktop-Chromium, 1500 Testfotos, kein iPhone): Liste
      473 KB; bis ans Ende gescrollt laden alle 1523 Vorschauen (106 MB) und der
      Browser-Speicher steigt von ca. 500 MB auf ca. 1,3 GB, weil alle Bilder im Dokument
      bleiben. Das Vorschaubild (800 px, `thumb.jpg`) selbst ist nicht das Problem und bleibt
      (das Polaroid braucht die Größe). Einige Hundert Fotos sind unkritisch, grenzwertig sind
      ca. 1500 Fotos bis ganz unten auf einem Gerät mit 3 GB. Zeigt der Test Probleme, in dieser
      Reihenfolge angehen:
      1. Automatisches Nachladen beim Scrollen nach 300 Fotos beenden, danach nur noch der
         Knopf „weitere Fotos anzeigen" (klein, sicher)
      2. Takt des Neuladens nach Größe: bis 300 Fotos alle 30 s, bis 1000 alle 60 s, darüber
         alle 120 s (klein, sicher; senkt die Datenmenge auf ein Viertel)
      3. Kleine Upload-Vorschau (320 px) nur für die Kacheln im Formular, falls das Auswählen
         vieler Fotos am iPhone hakt (der Upload bleibt bei 800 px)

## Nach der Hochzeit

- [ ] CI nach der Hochzeit: die `docker/*`-Aktionen (setup-buildx v3, login v3, metadata v5,
      build-push v6) auf die neuesten Versionen heben; sie laufen nur bei einem Tag und ließen
      sich vorher nicht ausprobieren
- [ ] Originale exportieren (Runbook §6)
- [ ] **Verwaiste R2-Objekte** aufräumen (abgebrochene Uploads, Erinnerung nach dem Foto-Upload
      nicht abgesendet): es gibt keinen Aufräum-Job; per Skript mit Abgleich zur Datenbank oder
      per Lifecycle-Regel (Runbook §6)

## Später, ohne Termin (nicht blockierend)

- [ ] **Große Galerien sauber lösen** (nach dem Fest, falls die Zahlen es verlangen):
      (a) Bilder, die weit außerhalb des Bildschirms liegen, aus dem Dokument nehmen und beim
      Zurückscrollen wieder laden, damit der Speicher nicht mit der Zahl der Fotos wächst;
      (b) beim Neuladen nur das Neue senden (`?after=<neuestes Foto>` mit Anzahl zur Kontrolle,
      bei einer Abweichung die ganze Liste) statt bei jeder Änderung die ganze Liste:
      bei 1500 Fotos ca. 470 KB je offener Galerie und Änderung, bei 100 Gästen gleichzeitig
      ca. 1,5 MB/s vom Server und ca. 60 MB je Stunde Mobilfunk am Handy; (c) eine zweite,
      kleine Vorschaugröße (ca. 400 px) für das Raster, falls die 800 px dort zu viel Speicher
      brauchen (Server, Datenbank und Upload müssten mit)
- [ ] **Videos:** werden nicht angenommen (nur JPEG, PNG, WebP, HEIC, HEIF bis 20 MB); am
      Auswahlfeld steht „Nur Fotos, keine Videos." Empfehlung: dabei bleiben, bis der Tag
      vorbei ist (größere Grenzen, andere Vorschau, mehr R2-Kosten)
