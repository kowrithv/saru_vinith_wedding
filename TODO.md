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

## Vor Go-Live zu erledigen (gefunden im Gästebuch/Erinnerungen-Review)

- **Rate-Limiter umgehbar, solange der Server direkt erreichbar ist:**
  `getClientKey` vertraut dem `cf-connecting-ip`-Header, den aber auch
  ein direkter Request an den Server (ohne über Cloudflare zu laufen)
  frei setzen kann — ein Angreifer kann das Limit so beliebig umgehen.
  Betrifft vor allem das offene, kennwortlose Gästebuch, dessen einzige
  Spam-Bremse der Rate-Limiter ist. Muss vor dem Freigeben der Seite für
  echten Internet-Traffic behoben sein: entweder den Server auf
  Cloudflare-IP-Bereiche beschränken (Firewall), oder Caddy so
  konfigurieren, dass es `cf-connecting-ip` von Nicht-Cloudflare-Quellen
  verwirft/überschreibt (`trusted_proxies`, aktuell nur ein
  TODO-Kommentar im Caddyfile).

## Gefunden im Feingranulare-Schreib-Sperre-Review (nicht blockierend)

- **Feature-Namen (`guestbook`/`memories`/`who_votes`) können ohne
  Testausfall voneinander abweichen:** `z.enum` in
  `api/admin/write-lock/route.ts` und die drei Durchsetzungs-Routen
  teilen sich keinen gemeinsamen Typ, der das erzwingt. Ein Test, der
  über alle drei Features loopt (statt nur `guestbook` zu prüfen),
  würde das abfangen. Empfehlung: `FEATURES` als `as const`-Array
  definieren und `z.enum(FEATURES)` darauf aufbauen.
- **Kein Test für „Wer-von-uns-Ergebnisse lesen funktioniert trotz
  aktiver Sperre"** (Review-Vorgabe aus dem Plan, im Code korrekt
  erfüllt — `GET /api/who-votes` prüft die Sperre nicht —, aber nie
  durch einen Test belegt).
- **Seltene Wettlaufsituation im Dashboard:** Tippt die Admin-Person
  zwei Schalter kurz hintereinander an, bevor die erste Server-Antwort
  da ist, kann eine spät eintreffende Antwort kurzzeitig den falschen
  Schalter-Zustand anzeigen. Nur Anzeigesache (ein Reload korrigiert
  es), betrifft nur die eine Admin-Person.

## Offene externe Abhängigkeiten (aus der Spec)

- R2/Cloudflare-Zugangsdaten für die Foto-Pipeline (Galerie-Plan)
- TLS/Domain-Entscheidung
- Git-Push-Zugriff auf `kowrithv/saru_vinith_wedding` (`hartingsdev`
  bekommt aktuell 403)

## Noch zu planende Subsysteme (Backlog aus der Spec)

- Galerie + R2-Upload-Pipeline (blockiert auf R2-Zugangsdaten) — dazu
  gehört auch der Foto-Teil von Erinnerungen, der im
  Gästebuch/Erinnerungen-Plan bewusst ausgeklammert wurde
  (`photo_key` bleibt bis dahin immer `null`)
- Admin-Dashboard-Erweiterung: Galerie-Modus-Schalter + Galerie-Lösch-Liste
  (der Rest des Admin-Dashboards — Login, Gästebuch-/Erinnerungs-Lösch-Liste,
  Schreib-Sperre als Notfall-Schalter — ist fertig)
- Betriebs-Härtung: SQLite-Backup-Cron, Festplatten-Alarm (Spec: stündlich
  `VACUUM INTO`, rotierend, plus eine Kopie off-box; Disk-Alarm bei 85%).
  Braucht noch vom Nutzer: Ziel für die Off-Box-Kopie (z. B. ein zweiter
  Server per rsync/SSH, oder ein Objekt-Storage-Bucket) und einen
  Alarm-Kanal (z. B. Discord-/Slack-Webhook, E-Mail) — ohne das lässt
  sich nur die lokale Rotation bauen, nicht die eigentliche Absicherung.
