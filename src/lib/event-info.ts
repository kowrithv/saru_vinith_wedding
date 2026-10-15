export const receptionEvent = {
  title: 'Empfang & Feier',
  date: '2026-10-17',
  // Absoluter Zeitpunkt mit Offset (MESZ, UTC+2): eine Angabe ohne Offset
  // würde in der Zeitzone des jeweiligen Geräts gelesen, und Gäste im
  // Ausland sähen den Countdown zur falschen Zeit ablaufen.
  startsAt: '2026-10-17T16:30:00+02:00',
  displayDate: '17. Oktober 2026',
  time: '16:30 Uhr',
  venue: 'Begegnungsstätte Niederkrüchten',
  address: 'Oberkrüchtener Weg 42, 41372 Niederkrüchten',
  parking: 'Parkplätze direkt an der Begegnungsstätte',
  description:
    'Wir laden euch herzlich zu unserem Empfang ein, um gemeinsam mit euch diesen besonderen Tag zu feiern.',
  lat: 51.196771,
  lng: 6.213148,
}

export interface ScheduleItem {
  time: string
  event: string
}

export const receptionSchedule: ScheduleItem[] = [
  { time: '16:30 Uhr', event: 'Einlass & Empfang der Gäste' },
  { time: 'TBA', event: 'Sektempfang & Gratulationen' },
  { time: 'TBA', event: 'Gemeinsames Abendessen' },
  { time: 'TBA', event: 'Party & Tanz' },
]

export interface GoodToKnowItem {
  title: string
  text: string
}

// Kurze Hinweise für Gäste (Kleidung, Kinder, Geschenke, Übernachtung ...).
// Solange die Liste leer ist, erscheint der Abschnitt "Gut zu wissen" auf
// /info gar nicht. Beispiel:
//   { title: 'Kleidung', text: 'Festlich, gern mit Farbe.' },
export const goodToKnow: GoodToKnowItem[] = []
