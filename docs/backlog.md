# Backlog (nicht blockierend, nicht für den Freeze)

Gesammelt, damit `TODO.md` nur das enthält, was jetzt ansteht.

## Zurückgestellte Entscheidungen

- **„Wer von uns?" als eigene Seite:** vorab abstimmen ohne Ergebnis, Auflösung später durch
  den Admin freigegeben (Schalter in der Konfiguration wie die Schreib-Sperren). Offen:
  DJ-Zugriff auf die Ergebnisse (Vorschlag: eigener Lese-Link mit langem Zufallsschlüssel,
  nur für die Ergebnisse) und ob mehrfaches Abstimmen erlaubt ist. Heute ist es ein
  Umschalter im Quiz (`/quiz`).
- **Videos:** werden nicht angenommen (nur JPEG, PNG, WebP, HEIC, HEIF bis 20 MB); am
  Auswahlfeld steht „Nur Fotos, keine Videos." Empfehlung: dabei bleiben, bis der Tag
  vorbei ist (größere Grenzen, andere Vorschau, mehr R2-Kosten).

## Inhalte, die nach Wunsch dazukommen

- Fotos je Meilenstein der Geschichte (`photo` in `src/lib/story-content.ts`).
- Texte für „Gut zu wissen" (`goodToKnow` in `src/lib/event-info.ts`): Kleidung, Kinder,
  Geschenke. Ohne Einträge erscheint der Abschnitt nicht.
- Porträts für „Wer von uns?" statt der Buchstaben-Marken (S, V).

## Technisch

- **Vorschau-Speicher:** jede Galerie-Kachel hält das 800-px-Thumbnail (ca. 2 MB Bitmap),
  bei 20 Fotos ca. 40 MB. Nur angehen, falls der Gerätetest Probleme zeigt.
- **Roter Punkt für neue Fotos** (aus dem Gestaltungsentwurf): bräuchte „zuletzt gesehen" je
  Gerät.
- **Memory-Rekord:** Admin-Knopf „alles entfernen, was mindestens so gut ist" und „Mehr
  anzeigen" über die besten 50 hinaus.
- **Verwaiste R2-Objekte** (abgebrochene Uploads, Erinnerung nach dem Foto-Upload nicht
  abgesendet): kein Aufräum-Job; per Skript mit Abgleich zur Datenbank oder per
  Lifecycle-Regel.
- `www.vsjourney.de` hat in der Caddyfile keinen Block.
- **„Wer von uns?" – Stimmen:** `/api/who-votes/vote` hat kein Limit und kein Kennwort; mit
  beliebigen `voterId` lassen sich Stimmen stopfen, und die Ergebnisse stehen live da. Beim
  Umbau der Seite (siehe oben) mit angehen: Kennwort/Sitzung und Limit je Gerät.
- **Client-Adresse:** Die Limits nehmen den ersten `X-Forwarded-For`-Eintrag (Caddy ≥ 2.5
  überschreibt den Header). Hängt die Seite einmal hinter einem Proxy, der anhängt, muss
  der Eintrag angepasst werden (`src/lib/client-ip.ts`).
