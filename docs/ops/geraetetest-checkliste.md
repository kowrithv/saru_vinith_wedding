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
- [ ] Name, Kategorie (Vorauswahl „Party"), 3 Fotos auswählen → Vorschau, Fortschritt, „3 Fotos hochgeladen – danke!". Ein Kennwortfeld erscheint nur, wenn der Browser noch nicht entsperrt ist.
- [ ] 10 Fotos auf einmal: Formular bleibt offen, Liste scrollt, Abbrechen sichtbar.
- [ ] **Beim Auswählen** füllen sich die Kacheln nacheinander mit der Vorschau (auf dem iPhone auch bei 10 Fotos ohne Ruckeln oder Neuladen der Seite); mit dem **×** auf einer Kachel lässt sich ein Foto vor dem Hochladen herausnehmen, hochgeladen werden nur die übrigen. Ein HEIC-Foto im Chrome zeigt statt der Vorschau ein Bild-Symbol.
- [ ] **Beim Auswählen** füllen sich die Kacheln nacheinander mit der Vorschau (auf dem iPhone auch bei 10 Fotos ohne Ruckeln oder Neuladen der Seite); mit dem **×** auf einer Kachel lässt sich ein Foto vor dem Hochladen herausnehmen, hochgeladen werden nur die übrigen. Ein HEIC-Foto im Chrome zeigt statt der Vorschau ein Bild-Symbol.
- [ ] **iPhone:** Foto im HEIC-Format (Originalformat) hochladen; erscheint in der Galerie, Original-Download funktioniert.
- [ ] Datei > 20 MB: klare Meldung mit Dateiname.
- [ ] Flugmodus während des Uploads: Fehlermeldung, nach erneutem „Hochladen" nur die unfertigen Fotos.
- [ ] „Abbrechen" mitten im Upload: keine Duplikate nach erneutem Versuch.
- [ ] Lightbox: öffnen, wischen/Pfeile, Original herunterladen, eigenes Foto löschen (nur auf dem Upload-Gerät).
- [ ] **Nach dem Anzeigen** eines Fotos (Galerie, Lightbox, Erinnerung) funktionieren „Original herunterladen“ und „Als Polaroid speichern“ für genau dieses Foto (nicht nur für eines, das man noch nicht gesehen hat).
- [ ] **Auswahl-Knopf** „Fotos auswählen“ (Galerie) bzw. „Foto auswählen“ (Erinnerungen): groß, gestrichelt, mit Kamera-Symbol; Tippen öffnet die Foto-Auswahl des Handys.
- [ ] **Gästebuch und Erinnerungen:** Auf Handy A die Seite offen lassen, auf Handy B einen Eintrag schreiben: nach höchstens ca. 30 Sekunden erscheint er auf A; ist A weit unten, erscheint „1 neuer Eintrag anzeigen" bzw. „1 neue Erinnerung anzeigen".
- [ ] **Filter** zeigen nur Kategorien, in denen Fotos liegen (anfangs z. B. nur „Alle“ und „Standesamt“).
- [ ] **Neuladen:** Auf Handy A die Galerie offen lassen, auf Handy B ein Foto hochladen: nach spätestens ca. 30 Sekunden erscheint es auf A. Ist A weit unten im Raster, erscheint stattdessen „1 neues Foto anzeigen“ und nichts springt. Läuft auf A selbst gerade ein Upload, lädt die Galerie währenddessen nicht neu. Bei offenem Upload-Formular ist der schwebende Knopf nur noch ein kleiner runder „Schließen"-Knopf und verdeckt keine Zeilen.
- [ ] Mobil-Menü offen: der schwebende Knopf liegt **unter** dem Menü.

## Erinnerung mit Foto (braucht R2)
- [ ] Erinnerungen: Name, Text und ein Foto wählen → **Vorschau des Fotos** (kleine Kachel), Dateiname und „×" erscheinen (HEIC außerhalb von Safari: graue Kachel statt Vorschau); absenden → Eintrag mit Foto in der Liste, Button zeigt „Foto wird hochgeladen…".
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

## Beamer und Punktestand (braucht `SCORE_PASSWORD` in `.env.production`)
- [ ] `/beamer` auf dem Laptop am Beamer öffnen: ohne Anmeldung nur das Kennwortfeld; das **Admin**-Kennwort wird abgewiesen, `SCORE_PASSWORD` öffnet die Anzeige. Vollbild (F11): Namen, Datum, beide Kästen vollständig sichtbar, nichts abgeschnitten, auch im echten Beamer-Format.
- [ ] `/punkte` am Handy öffnen (anmelden): +1 für Bride, +1 für Groom, −1: **der Beamer folgt in unter einer Sekunde** und der Punkt unten links ist **grün**. Bei jedem Punkt schwebt ein **„+1“** neben der Zahl des Teams auf. Orange heißt: der Proxy hält den Strom zurück (Anzeige stimmt trotzdem, nur alle 3 Sekunden) – dann Caddy prüfen.
- [ ] Zwei Handys tippen gleichzeitig auf dasselbe Team: beide Punkte kommen an. Handy ins Flugmodus und zurück: die Seite holt den Stand von selbst.
- [ ] „Auf 0 zurücksetzen" fragt nach; nach „Ja" zeigt der Beamer 0 : 0. Die Beamer-Seite 5 Minuten offen lassen: Bildschirm bleibt an, Stand stimmt noch.
- [ ] Ohne Anmeldung ist `/api/score` gesperrt (401), die Seiten stehen nicht in der Navigation.

## Spiele und Einträge
- [ ] Quiz (klassisch): alle Fragen durchspielen, Auswertung am Ende.
- [ ] „Wer von uns?" (`/wer-von-uns`): drei Fotos statt Namen (zwei Quadrate, darunter das gemeinsame), das gewählte bekommt einen Haken; Kennwortfeld nur, wenn der Browser nicht entsperrt ist; nach der Stimme ein Haken auf dem Foto und „Weiter", **ohne** Zahlen und ohne Satz; ein anderes Foto antippen ändert die Stimme (der Haken wandert), „Zurück" und auf der Dank-Seite „Antworten ansehen und ändern" funktionieren; Seite schließen und öffnen: es geht bei der ersten offenen Frage weiter. Im Admin „Alle Stimmen löschen" (mit Rückfrage): Zähler 0, und das Test-Handy beginnt ohne Löschen der Browserdaten wieder bei Frage 1; nach „Freigegeben" ist der Knopf gesperrt.
- [ ] Admin „Wer von uns?": „Beendet" → Gäste-Handy zeigt „Die Abstimmung ist beendet" ohne Fotos und ohne Ergebnisse, weitere Stimmen werden abgewiesen; „Freigegeben" (mit Rückfrage) → Gäste-Handy zeigt die Verteilung; „Abstimmen" → Abstimmen geht wieder. Am Rechner des DJ: `vsjourney.de/dj` öffnen, das Wort aus dem Admin eintippen (Groß-/Kleinschreibung egal); die Ergebnisse stehen schon vor der Freigabe da und aktualisieren sich alle paar Sekunden. Ein falsches Wort wird abgelehnt.
- [ ] Memory: die Zeit startet erst mit der **ersten aufgedeckten Karte**.
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
