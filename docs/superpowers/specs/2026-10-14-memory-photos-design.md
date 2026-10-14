# Fotos zu Erinnerungen (landen auch in der Galerie)

Stand 14.10.2026, vor dem Freeze am 15.10. Entscheidungen des Nutzers: **ein Foto**
je Erinnerung, **nur entsperrte Browser** sehen es, **eigener Notaus-Schalter**; das
Foto **landet auch in der Galerie**.

## Verhalten

- Das Erinnerungs-Formular hat ein optionales Foto-Feld. Ohne Foto bleibt alles wie
  bisher.
- Das Foto ist ein **normales Galerie-Foto** (Vorschau 800 px + Original, gleiche
  Pipeline, Kategorie neu: **„Erinnerungen"**, Name = Name der Erinnerung). Es
  erscheint in der Galerie und an der Erinnerung.
- Ein Foto und sein Eintrag entstehen **in einer Anfrage**: der Browser lädt per
  Ticket nach R2, schickt dann `POST /api/memories` mit dem Ticket; der Server prüft
  die Objekte, legt Galerie-Foto und Eintrag in **einer Transaktion** an. Scheitert
  etwas, gibt es keinen halben Zustand.
- Der Gast bekommt wie bei jedem Galerie-Upload ein Lösch-Token für das Foto (im
  Browser gespeichert; Löschen in der Lightbox).

## Sichtbarkeit und Löschen

- `GET /api/memories` liefert die Foto-URLs nur an Browser mit Gast-Sitzung (oder
  Admin). Andere sehen den Text und den Hinweis „Foto nach dem Entsperren". Rohe
  R2-Schlüssel verlassen den Server nie.
- Admin löscht einen Eintrag: Foto (R2, Zeile, Cache) geht mit. Wird das Foto in
  der Galerie gelöscht, bleibt der Text, das Foto fehlt.
- Das Löschen eines Eintrags ist weiterhin nur dem Admin möglich.

## Notaus

- Neuer Schalter **„Erinnerungs-Fotos"** (`memory_photos`): sperrt nur das Anhängen.
  Texte, Galerie und Foto-Upload bleiben. Zusätzlich gilt der Schalter „Foto-Upload"
  (`gallery_upload`) wie für jedes Foto. Gesperrt: das Feld verschwindet, ein
  Request mit Ticket bekommt 423.

## Technik

- Spalte `memories_entries.photo_id` (idempotente Migration, Verweis auf
  `gallery_photos.id`); `photo_key` bleibt ungenutzt.
- `registerUploadedPhoto` (neu, aus `/api/uploads/complete` herausgelöst) prüft
  Ticket-Objekte per HeadObject; ein schon registriertes Ticket ergibt 409, nicht 500.
- `removeGalleryPhoto` (neu, aus `DELETE /api/gallery/[id]` herausgelöst) löscht
  R2-Objekte, Zeile und Cache; auch der Admin-Löschweg der Erinnerungen nutzt es.
- Browser: Vorschau und Größe vor der Ticket-Anfrage (siehe `thumbSize`), Foto auf
  Dateityp/20 MB geprüft; nicht dekodierbare Bilder (HEIC außerhalb von Safari)
  bekommen die neutrale Vorschau, das Original geht trotzdem hoch.

## Nicht Teil dieser Änderung

- Mehrere Fotos je Erinnerung, Foto-Austausch nachträglich, Löschen durch Gäste.
- Aufräumen verwaister R2-Objekte (bleibt in `TODO.md`).

## Umsetzung (Reihenfolge, TDD)

1. Schema + `memories.ts` (Foto per Join), Kategorie „Erinnerungen", Schalter
   `memory_photos`.
2. `registerUploadedPhoto`, `removeGalleryPhoto` herauslösen (bestehende Tests grün).
3. `POST`/`GET`/`DELETE /api/memories` mit Foto.
4. Browser: Vorschau-Helfer teilen, Foto-Upload-Helfer, Erinnerungs-Seite, Admin.
5. Doku, Gerätetest-Checkliste, Runbook (Schalter).
