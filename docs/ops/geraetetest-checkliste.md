# Gerätetest-Checkliste (Mittwoch 14.10.)

Echte Handys, mobile Daten **und** schwaches WLAN. Je Gerät abhaken. Ergebnisse
mit Gerät, Browser und Uhrzeit notieren; Auffälliges als Screenshot.

Geräte: ☐ iPhone (Safari) ☐ Android (Chrome) ☐ ältere Hardware ☐ Desktop

## Startseite
- [ ] Countdown passt komplett in die Breite (kein seitliches Wischen), Ziffern ändern sich im Sekundentakt.
- [ ] Hero ist ohne Verzögerung sichtbar, „Mehr entdecken" scrollt zum Countdown.
- [ ] Kacheln führen auf die richtigen Seiten; Texte sind gut lesbar.

## Galerie und Upload (braucht R2)
- [ ] „Fotos hochladen" öffnet das Formular und scrollt es ins Bild.
- [ ] Name, Kennwort, Kategorie (Vorauswahl „Hochzeit"), 3 Fotos auswählen → Vorschau, Fortschritt, „3 Fotos hochgeladen – danke!".
- [ ] 10 Fotos auf einmal: Formular bleibt offen, Liste scrollt, Abbrechen sichtbar.
- [ ] **iPhone:** Foto im HEIC-Format (Originalformat) hochladen; erscheint in der Galerie, Original-Download funktioniert.
- [ ] Datei > 20 MB: klare Meldung mit Dateiname.
- [ ] Flugmodus während des Uploads: Fehlermeldung, nach erneutem „Hochladen" nur die unfertigen Fotos.
- [ ] „Abbrechen" mitten im Upload: keine Duplikate nach erneutem Versuch.
- [ ] Lightbox: öffnen, wischen/Pfeile, Original herunterladen, eigenes Foto löschen (nur auf dem Upload-Gerät).
- [ ] Mobil-Menü offen: der schwebende Knopf liegt **unter** dem Menü.

## Spiele und Einträge
- [ ] Quiz klassisch und „Wer von uns?": Abstimmen, Ergebnis aktualisiert sich.
- [ ] Memory: komplettes Spiel, „Neuer Rekord"-Meldung, Rekord aller Gäste wird angezeigt; Brett springt nicht.
- [ ] Gästebuch und Erinnerungen: Eintrag schreiben (Erinnerungen mit Kennwort), erscheint in der Liste.
- [ ] Eingabefelder: iOS zoomt beim Tippen **nicht** in die Seite.

## Admin (am Handy)
- [ ] Login, vier Schalter, Abschnitte einklappen/aufklappen.
- [ ] Foto-Upload sperren → Gast-Gerät zeigt „pausiert"; entsperren → geht wieder.
- [ ] Foto löschen (mit Rückfrage), „Memory-Rekord zurücksetzen" (mit Rückfrage).

## Grundlagen
- [ ] `https://vsjourney.de` und `https://www.vsjourney.de`: gültiges Zertifikat, keine Warnung.
- [ ] Unbekannte Adresse (`/gibtsnicht`) landet auf der Startseite.
- [ ] `node scripts/smoke.mjs https://vsjourney.de` ist grün.
