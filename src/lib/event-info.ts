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

// Aufschrift des Polaroids (Beispiel von Vinith): der Anlass und das Datum in
// der Schreibweise "17.10.2026" - aus dem Datum der Feier abgeleitet.
export const polaroidCaption = {
  occasion: 'Standesamtliche Hochzeit',
  date: receptionEvent.date.split('-').reverse().join('.'),
}

/** Symbol des Programmpunkts in der Zeitleiste (siehe ProgramTimeline). */
export type ScheduleIcon = 'door' | 'cake' | 'flower' | 'dinner' | 'music'

export interface ScheduleItem {
  time: string
  event: string
  icon?: ScheduleIcon
}

// Stand der Brautleute vom 15.10.: ungefähre Zeiten mit "ca."; für "Als
// Nächstes" zählt der Beginn (siehe event-phase.ts). Ohne Uhrzeit: 'TBA'.
export const receptionSchedule: ScheduleItem[] = [
  { time: '16:30 Uhr', event: 'Einlass & Empfang der Gäste', icon: 'door' },
  { time: '17:15 Uhr', event: 'Einzug des Brautpaares / Tortenanschneiden', icon: 'cake' },
  { time: 'ca. 18:30 Uhr', event: 'Traditioneller Einzug des Brautpaares', icon: 'flower' },
  { time: 'ca. 20:00 – 21:00 Uhr', event: 'Gemeinsames Abendessen', icon: 'dinner' },
  { time: 'ca. 22:30 Uhr', event: 'Party & Tanz', icon: 'music' },
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
