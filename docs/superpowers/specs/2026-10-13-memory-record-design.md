# Gemeinsamer Rekord im Liebes-Memory — Design

Stand: 2026-10-13. Kurze Design-Notiz zu einer begrenzten Änderung an
bestehendem Code (Pfad „bounded": Skizze im Chat abgestimmt, kein eigener Plan).

## Ziel
Alle Gäste sehen **einen gemeinsamen Rekord** für das Liebes-Memory. Gespeichert
wird nur der Highscore — **keine Namen, keine Liste der Spiele**.

## Entscheidungen
- Regel (Nutzer): erst weniger Züge, bei Gleichstand die kürzere Zeit — wie die
  lokale Bestzeit.
- Speicher: zwei Schlüssel in `app_config` (`memory_record_moves`,
  `memory_record_seconds`), kein neues Schema.
- Ersetzen nur bei besserem Ergebnis, in einer Transaktion mit sofortiger
  Schreibsperre.
- Plausibilitätsgrenzen: ganze Zahlen, Züge 8..500 (acht Paare), Sekunden
  4..5999. Sie halten nur absurde Werte ab; Fälschung ist ohne
  serverseitiges Spiel nicht zu verhindern (siehe `TODO.md`).
- Rate-Limit 600 je 15 Minuten und Adresse: großzügig, weil viele Gäste die IP
  des Veranstaltungs-WLANs teilen und eine abgewiesene Meldung unbemerkt bliebe.
- Admin: aktueller Rekord sichtbar und mit Rückfrage zurücksetzbar (Testspiele
  vor der Feier, unmögliche Werte).

## Verhalten im Spiel
- Rekord wird beim Laden abgefragt, ein gewonnenes Spiel meldet sich genau
  einmal. Antworten gelten nur in Anfrage-Reihenfolge; die Meldung „Neuer
  Rekord" gehört nur zum Spiel, das ihn gebrochen hat.
- Die Zeit läuft erst ab der ersten aufgedeckten Karte (Änderung vom
  13.10.2026): Lesezeit und Wartezeit auf der Seite zählen nicht, bei gleich
  vielen Zügen entscheidet so die gespielte Zeit. „Neues Spiel" wartet wieder
  auf die erste Karte.
- Netzwerkfehler und Fehlerstatus stören das Spiel nie.
- Die Rekord-Zeile reserviert ihre Höhe von Anfang an (kein Springen des Bretts).

## Änderung 13.10.2026 (abends): alle gemeldeten Ergebnisse speichern

Entscheidung (Nutzer): Das Spiel bleibt clientseitig, wir vertrauen darauf, dass
es fair gespielt wird. Fälschungen werden nicht verhindert, sondern im Admin
behandelt - dafür werden alle gemeldeten Ergebnisse gespeichert.

- Tabelle `memory_results` (`moves`, `seconds`, `created_at`; weiterhin **keine
  Namen und keine Adresse**). Der Rekord ist das beste gespeicherte Ergebnis
  (Züge, dann Zeit, dann das früheste).
- Obergrenze 100.000 Ergebnisse (gemessen: rund 5 MB, Abfragen unter 0,1 ms; die
  erste Fassung hatte 2000 und war unnötig knapp): darüber fallen die
  schlechtesten weg, der Rekord und die Spitze der Liste bleiben erhalten. Ein
  Skript bräuchte mit dem Limit von 600 Meldungen je 15 Minuten rund 42 Stunden
  von einer Adresse, um ehrliche Ergebnisse zu verdrängen.
- Admin: Liste der 50 besten (`GET /api/admin/memory-results`), einzelnes
  Ergebnis mit Bestätigung entfernen (`DELETE /api/admin/memory-results/<id>`);
  der Rekord fällt dann auf das nächstbeste zurück. „Rekord zurücksetzen"
  löscht weiterhin alle.
- Der alte Rekord (zwei `app_config`-Schlüssel) wird beim Start einmalig als
  Ergebnis übernommen.
- Öffentlich ändert sich nichts: `GET`/`POST /api/memory-record` antworten wie bisher.
