export type TimelineIcon =
  | 'heart'
  | 'message'
  | 'family'
  | 'flower'
  | 'ring'
  | 'certificate'

export interface TimelineItem {
  id: string
  year: string
  title: string
  description: string
  icon: TimelineIcon
  align: 'left' | 'right'
}

export const storyTimeline: TimelineItem[] = [
  {
    id: '1',
    year: '15.11.2023',
    title: 'Wo alles begann',
    description:
      'Drei Jahre lebte Saruga schon in Mainz, Vinith erst seit einem Jahr – trotzdem brauchte es gemeinsame Freunde und ein kleines bisschen Schicksal, damit sich ihre Wege endlich kreuzten. Der erste Eindruck war denkbar unterschiedlich: Er fand sie ganz schön arrogant und wortkarg, sie hielt ihn für sympathisch, rechnete aber nicht damit, ihn je wiederzusehen. Eine Woche später schrieb er ihr – aus einer Nachricht wurden viele, aus gelegentlichem Schreiben täglicher Kontakt. Ganz langsam begann etwas, von dem beide damals noch nicht ahnten, wohin es einmal führen würde.',
    icon: 'heart',
    align: 'left',
  },
  {
    id: '2',
    year: '07.01.2024',
    title: 'Aus uns wurde Wir',
    description:
      'Eine WhatsApp-Nachricht genügte: Hast du am 07.01. Zeit und Lust auf ein Date? Das Timing hätte besser sein können – Saruga war krank und gerade in Saarbrücken. Abgesagt wurde trotzdem nicht. Vinith kam nicht nur zum Date, sondern mit einer kleinen Tüte voller Tee, Wärmekissen und Schokolade im Gepäck – eine Geste, die ihr bis heute im Gedächtnis geblieben ist. Danach ging es gemeinsam nach Frankfurt zu Anjappar, wo bei gutem Essen geredet wurde, bis es draußen dunkel wurde. Als Saruga schließlich den Rückweg vorschlug, hatte Vinith noch etwas vor: Nach einer ziemlich süßen Rede fragte er, ob sie mit ihm zusammen sein möchte. Aus zwei Menschen, die sich wenige Wochen zuvor zufällig kennengelernt hatten, wurde ganz offiziell ein Wir.',
    icon: 'message',
    align: 'right',
  },
  {
    id: '3',
    year: '08.02.2026',
    title: 'Wenn aus zwei Menschen zwei Familien werden',
    description:
      'Ende Januar sprachen die Eltern miteinander und entschieden gemeinsam, dass der nächste große Schritt beginnen durfte. Am 08. Februar trafen sich beide Familien zum ersten Mal offiziell bei Vinith zu Hause. Nach tamilischer Tradition brachte die Familie der Braut kunstvoll dekorierte Silbertabletts mit Geschenken mit – Kokosnuss, Blumen, Obst, Kleidung, Süßspeisen und mehr. Die Familie des Bräutigams empfing sie herzlich mit einem festlich geschmückten Empfangstisch, und natürlich wurde ausgiebig gegessen, von der Vorspeise bis zum Dessert. Weil es an diesem Tag gleich doppelt etwas zu feiern gab, durfte auch eine Torte zum bestandenen Masterabschluss des Bräutigams nicht fehlen. Ein Tag voller Traditionen – und der Tag, an dem sich nicht nur zwei Menschen, sondern auch zwei Familien näherkamen.',
    icon: 'family',
    align: 'left',
  },
  {
    id: '4',
    year: '21.03.2026',
    title: 'Nichayathartham',
    description:
      'Diesmal besuchte die Familie des Bräutigams die Braut und ihre Familie – auch sie brachte liebevoll vorbereitete Geschenktabletts mit. Nachdem alle Platz genommen hatten, wurde Saruga zum ersten Mal offiziell den Eltern und der ganzen Familie von Vinith vorgestellt. Er kam nicht mit leeren Händen: ein Blumenstrauß für seine zukünftige Braut. Danach wurde gemeinsam gesprochen, gelacht und natürlich wieder ausgiebig gegessen, bevor die Nichayathartham-Torte angeschnitten wurde. Zum Abschluss wurde der ganzen Familie offiziell das Datum ihrer Hochzeit verkündet: der 17. Oktober 2026.',
    icon: 'flower',
    align: 'right',
  },
  {
    id: '5',
    year: '09.07.2026',
    title: 'Die Frage aller Fragen',
    description:
      'Eigentlich sollte an diesem Abend nur die bestandene staatliche Pflichtfachprüfung der Braut gefeiert werden. Nach einem schönen Essen ging es weiter in den Deutsch-Französischen Garten – Sonnenuntergang, ein kleiner Spaziergang. So der Plan. Tatsächlich verliefen sich beide gleich zweimal, während in der Ferne plötzlich Lichter und tamilische Musik zu hören waren – und Vinith auffällig ruhig und nervös wurde. Vor einer wunderschön dekorierten Kulisse wurde klar, was hier gerade passierte: Nach und nach kamen die liebsten Menschen hervor – Geschwister, Eltern, Cousinen und Cousins. Der Traumring, die Location, die Dekoration und vor allem die Menschen, die beiden am meisten bedeuten – für Saruga war es der Antrag, den sie sich immer gewünscht hatte. Und die Antwort auf die Frage aller Fragen war natürlich: Ja.',
    icon: 'ring',
    align: 'left',
  },
  {
    id: '6',
    year: '17.10.2026',
    title: 'Unser Ja',
    description:
      'Von einem zufälligen ersten Treffen über unzählige Nachrichten, das erste Date, zwei Familien, die zusammenfanden, das Nichayathartham und einen unvergesslichen Antrag – so führt unsere Geschichte hierher. Am 17. Oktober 2026 sagen wir Ja. Doch diese Geschichte gehört nicht nur uns – an diesem Tag seid auch ihr ein Teil davon. Was habt ihr an diesem Tag erlebt, was ist euch besonders in Erinnerung geblieben? Teilt eure Erinnerungen, Gedanken und Lieblingsmomente mit uns auf der Erinnerungen-Seite dieser Website – dann können wir diesen Tag später nicht nur durch unsere, sondern auch durch eure Augen noch einmal erleben.',
    icon: 'certificate',
    align: 'right',
  },
]
