# „Wer von uns?" als eigene Seite (15.10.2026)

## Ziel

Gäste stimmen vorab ab, ohne Ergebnisse zu sehen. Das Brautpaar gibt die Auflösung
später frei; der DJ sieht die Ergebnisse vorher über einen eigenen Link. Aus den
Buchstaben-Marken (S, V) werden Porträts.

## Entscheidungen (Vorgaben, jederzeit änderbar)

- **Eine Stimme je Frage und Gerät** (wie bisher, kein Ändern, kein Mehrfach-Abstimmen).
- **DJ-Zugang:** Seite `/dj` mit einem **Wort** (der DJ tippt es ab, deshalb kein
  langer Schlüssel). Das Wort wird aus `HMAC(Admin-Schlüssel, 'who-results-link')` aus der
  Liste `RESULTS_WORDS` gewählt (nichts zu speichern, stabil, ändert sich mit
  `ADMIN_SECRET`). Es kommt per Header `x-results-key`; der Link zum Kopieren trägt es als
  `#k=<Wort>` im Fragment (nie im Server-Log, nie im Referer). Es gibt nur die Ergebnisse frei, sonst nichts.
  Ein Wort ist kein starkes Geheimnis; es hält Gäste vom Vorab-Blick ab. Deshalb: falsche
  Wörter werden je Adresse gebremst (20 in 15 Minuten, dann 429), das richtige wird nie
  abgewiesen.
- **Auflösung:** Schalter `who_results_released` in `app_config` (Admin-Bereich). Mit der
  Freigabe ist die Abstimmung beendet: `POST /api/who-votes/vote` antwortet 423, die Seite
  zeigt die Ergebnisse. Der bestehende Schalter `who_votes` (Abstimmung sperren) bleibt
  unabhängig.
- **Kennwort:** abstimmen braucht das Gäste-Kennwort bzw. die Sitzung (`gateGuest`, wie
  Gästebuch). Limit je Gerät 60 Stimmen / 15 Minuten, je Adresse 1500 (erste Stimme ohne
  Sitzung, gemeinsames WLAN; das Einlese-Skript für die alten Stimmen kommt von einer
  Adresse).
- **Porträts:** zwei Ausschnitte aus `public/hero/paar.jpg` als
  `public/who/saruga.jpg` und `public/who/vinith.jpg` (quadratisch, 192 px). Zum Tauschen
  die Datei ersetzen. „Beide" zeigt beide Porträts überlappt.

## API

- `GET /api/who-votes` → `{ released: boolean, questions: TallyMap | null }`. `questions`
  nur bei Freigabe, mit gültigem `x-results-key` oder als Admin; sonst `null`.
- `POST /api/who-votes/vote` Body `{ questionId, voterId, option, password? }` →
  `{ alreadyVoted }` (kein Zwischenstand). 423 bei Sperre oder Freigabe, 401/429 wie
  Gästebuch.
- `GET|POST /api/admin/who-results` (nur Admin) → `{ released, key }`; POST `{ released }`.

## Seiten

- `/wer-von-uns` (Navigation „Wer von uns?"): Fragen nacheinander; bei der ersten offenen
  Frage beginnen; Kennwortfeld nur wenn nicht entsperrt; nach der Stimme „Gespeichert"
  statt der Ergebnisse; am Ende Dank. Nach der Freigabe: Ergebnisse aller Fragen, die
  eigene Stimme markiert.
- `/dj` (DJ): Ergebnisse aller Fragen, alle 5 s aktualisiert. Das Wort kommt aus dem Link
  (`#k=`), aus dem Browser (beim nächsten Besuch) oder aus einem Eingabefeld.
- `/quiz`: nur noch das klassische Quiz, mit Verweis auf die neue Seite.

## Admin

Abschnitt „Wer von uns?": Schalter „Auflösung für Gäste freigeben" (mit Hinweis, dass die
Abstimmung damit endet), Adresse und Wort für den DJ, Link zum Kopieren.

## Folgen

- Lasttest: Stimmen mit Kennwort; geprüft wird über `alreadyVoted` (Zähler sind
  verborgen).
- Smoke-Test: `/api/who-votes` liefert `released`.
- `scripts/import-old-votes.mjs`: `--password` bzw. `GUEST_PASSWORD`, bei 429 warten.
- Alte Stimmen bleiben gültig (gleiche Tabelle).
