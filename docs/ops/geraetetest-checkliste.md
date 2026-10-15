# Gerätetest-Checkliste (vor dem Freeze, Stand 15.10.)

Echte Handys, mobile Daten **und** schwaches WLAN. Je Gerät abhaken. Ergebnisse
mit Gerät, Browser und Uhrzeit notieren; Auffälliges als Screenshot.

Geräte: ☐ iPhone (Safari) ☐ Android (Chrome) ☐ ältere Hardware ☐ Desktop

## Startseite
- [ ] Countdown passt komplett in die Breite (kein seitliches Wischen), Ziffern ändern sich im Sekundentakt.
- [ ] Hero ist ohne Verzögerung sichtbar, „Mehr entdecken" scrollt zum Countdown.
- [ ] Kacheln führen auf die richtigen Seiten; Texte sind gut lesbar; die vier kleinen Fotos auf „Unsere Fotos" erscheinen.
- [ ] Hero-Foto im Bogenrahmen: beide Gesichter sichtbar, nicht abgeschnitten.
- [ ] **Zustände** mit `/?zeit=heute`, `/?zeit=feier`, `/?zeit=danach`: Hero-Knöpfe, Countdown-Bereich und „Als Nächstes" im Ablauf passen; das Band „Vorschau" unten links beendet es.

## Zugang (QR-Code und Kennwort)
- [ ] **QR-Code** mit der Kamera-App scannen: Galerie öffnet sich ohne Eingabe, die Adresszeile zeigt kein `#k=` mehr.
- [ ] Seite im privaten Fenster **ohne** QR-Code öffnen (`/gallery`): nur das Kennwortfeld, **keine** Fotos sichtbar.
- [ ] Falsches Kennwort → Meldung „Falsches Kennwort."; richtiges (auch in anderer Groß-/Kleinschreibung) → Galerie öffnet sich.
- [ ] Danach `/guestbook` und `/memories`: kein Kennwortfeld mehr, Eintrag lässt sich schreiben.
- [ ] Browser komplett schließen und neu öffnen: weiterhin entsperrt.
- [ ] Privates Fenster: im Gästebuch mit Kennwort schreiben → danach ist auch die Galerie offen (ein Kennwort für alles).
- [ ] Im Gästebuch **ohne** Kennwort absenden: Hinweis, kein Eintrag.
- [ ] Name im Gästebuch eintragen und absenden → in Erinnerungen und im Upload-Formular steht er schon im Feld (änderbar).
- [ ] Footer: keine zweite Navigation, nur Namen, Hashtag, Datum.
- [ ] Mehrere falsche Kennwörter hintereinander (über 20): ab dann Meldung mit Wartezeit; das **richtige** Kennwort und der QR-Code gehen weiterhin sofort.

## Galerie und Upload (braucht R2)
- [ ] „Fotos hochladen" öffnet das Formular und scrollt es ins Bild.
- [ ] Kategorie-Auswahl zeigt nur „Standesamt" und „Party"; am Auswahlfeld steht „Nur Fotos, keine Videos."
- [ ] Name, Kategorie (Vorauswahl „Standesamt"), 3 Fotos auswählen → Vorschau, Fortschritt, „3 Fotos hochgeladen – danke!". Ein Kennwortfeld erscheint nur, wenn der Browser noch nicht entsperrt ist.
- [ ] 10 Fotos auf einmal: Formular bleibt offen, Liste scrollt, Abbrechen sichtbar.
- [ ] **iPhone:** Foto im HEIC-Format (Originalformat) hochladen; erscheint in der Galerie, Original-Download funktioniert.
- [ ] Datei > 20 MB: klare Meldung mit Dateiname.
- [ ] Flugmodus während des Uploads: Fehlermeldung, nach erneutem „Hochladen" nur die unfertigen Fotos.
- [ ] „Abbrechen" mitten im Upload: keine Duplikate nach erneutem Versuch.
- [ ] Lightbox: öffnen, wischen/Pfeile, Original herunterladen, eigenes Foto löschen (nur auf dem Upload-Gerät).
- [ ] Mobil-Menü offen: der schwebende Knopf liegt **unter** dem Menü.

## Erinnerung mit Foto (braucht R2)
- [ ] Erinnerungen: Name, Text und ein Foto wählen → Dateiname und „×" erscheinen; absenden → Eintrag mit Foto in der Liste, Button zeigt „Foto wird hochgeladen…".
- [ ] Dasselbe Foto steht in der **Galerie** (Kategorie „Erinnerungen", „Von <Name>") und lässt sich mit dem Lösch-Knopf in der Lightbox entfernen (nur auf diesem Gerät).
- [ ] **iPhone** (Foto direkt aus der Kamera/HEIC) und **Android-Chrome**: hochladen; nicht dekodierbare Bilder werden trotzdem angenommen (graue Vorschau in der Galerie).
- [ ] Datei > 20 MB oder keine Bilddatei: Meldung, es wird nichts hochgeladen.
- [ ] Privates Fenster ohne Entsperren: die Erinnerung zeigt den Text und „Foto – sichtbar nach dem Entsperren", kein Bild.
- [ ] **Polaroid** (entsperrt): Foto, „STANDESAMTLICHE HOCHZEIT", „Saruga & Vinith", „17.10.2026", Herz, „Erinnerung von <Name>".
- [ ] „Als Polaroid speichern" am **iPhone**: Teilen-Menü, „Bild sichern" legt es in die Fotos; am **Android**: Teilen-Menü; am **Computer**: Download. Das Bild sieht aus wie auf der Seite (Schriften, Datum).
- [ ] Admin: Eintrag mit Foto löschen (mit Rückfrage) → auch in der Galerie weg; Bild-URL liefert sofort 404.
- [ ] Schalter „Erinnerungs-Fotos" sperren → das Fotofeld verschwindet, Text geht weiter.

## Dienstleister und Info
- [ ] `/info`: Abschnitt „Unsere Dienstleister" mit sechs Einträgen; jeder Link öffnet das richtige Profil in einem neuen Tab.
- [ ] Anfahrt-Karte: „Route planen" öffnet die Karten-App, „In Kalender speichern" legt den Termin an.

## Spiele und Einträge
- [ ] Quiz klassisch und „Wer von uns?": Abstimmen, Ergebnis aktualisiert sich.
- [ ] Memory: komplettes Spiel, „Neuer Rekord"-Meldung, Rekord aller Gäste wird angezeigt; Brett springt nicht.
- [ ] Memory: zwei Runden hintereinander („Neues Spiel"): keine leere Karte beim Umdrehen, auch im schwachen WLAN.
- [ ] Gästebuch und Erinnerungen: Eintrag schreiben (Kennwort nur, wenn der Browser noch nicht entsperrt ist), erscheint in der Liste.
- [ ] Eingabefelder: iOS zoomt beim Tippen **nicht** in die Seite.

## Admin (am Handy)
- [ ] Login, vier Schalter, Abschnitte einklappen/aufklappen.
- [ ] Foto-Upload sperren → Gast-Gerät zeigt „pausiert"; entsperren → geht wieder.
- [ ] Foto löschen (mit Rückfrage), „Memory-Rekord zurücksetzen" (mit Rückfrage).

## Grundlagen
- [ ] `https://vsjourney.de` und `https://www.vsjourney.de`: gültiges Zertifikat, keine Warnung.
- [ ] Unbekannte Adresse (`/gibtsnicht`) landet auf der Startseite.
- [ ] `node scripts/smoke.mjs https://vsjourney.de` ist grün.
