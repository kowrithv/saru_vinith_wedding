# Backlog (nicht blockierend, nicht für den Freeze)

Gesammelt, damit `TODO.md` nur das enthält, was jetzt ansteht.

## Zurückgestellte Entscheidungen

- **Videos:** werden nicht angenommen (nur JPEG, PNG, WebP, HEIC, HEIF bis 20 MB); am
  Auswahlfeld steht „Nur Fotos, keine Videos." Empfehlung: dabei bleiben, bis der Tag
  vorbei ist (größere Grenzen, andere Vorschau, mehr R2-Kosten).

## Inhalte, die nach Wunsch dazukommen

- Andere Fotos für „Wer von uns?": `public/who/saruga.jpg`, `vinith.jpg` (quadratisch,
  640 px) und `beide.jpg` (2:1, 1000 x 500 px); Datei ersetzen.

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
