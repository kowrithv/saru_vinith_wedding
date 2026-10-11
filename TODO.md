# TODO

## Inhaltliche Entscheidungen (vor Code-Freeze Do. 15.10. abends)

- **FAQ widerspricht der neuen Info-Seite:**
  - FAQ #1 sagt „Die genaue Adresse ist auf der Einladung vermerkt" —
    `/info` zeigt die Adresse inzwischen aber öffentlich inkl. Karte.
  - FAQ #5 verweist auf „E-Mail oder Telefon" zur Anmeldung — auf der
    Seite steht aber nirgends eine Telefonnummer.
  - FAQ #5 nennt als Anmeldefrist „1. September 2026" — aus heutiger
    Sicht (11.10.2026) bereits vergangen.
  - Alle drei Punkte 1:1 aus der alten Seite übernommen, bewusst nicht
    selbst „korrigiert" — das ist eine inhaltliche Entscheidung.

## Offene externe Abhängigkeiten (aus der Spec)

- R2/Cloudflare-Zugangsdaten für die Foto-Pipeline (Galerie-Plan)
- TLS/Domain-Entscheidung
- Git-Push-Zugriff auf `kowrithv/saru_vinith_wedding` (`hartingsdev`
  bekommt aktuell 403)

## Noch zu planende Subsysteme (Backlog aus der Spec)

- Quiz „Wer von uns?"
- Memory-Spiel
- Galerie + R2-Upload-Pipeline (blockiert auf R2-Zugangsdaten)
- Gästebuch
- Erinnerungen
- Admin-Dashboard (Löschen/Moderation, Galerie-Modus-Umschalter)
- Betriebs-Härtung: SQLite-Backup-Cron, Festplatten-Alarm, Caddy
  `trusted_proxies` für Cloudflare (aktuell nur TODO-Kommentar im
  Caddyfile)
