import { GalleryImage, GuestbookEntry, Memory, QuizQuestion, TimelineItem, FAQItem, WeddingEvent, WhoQuestion } from '@/types'

export const couple = {
  bride: 'Saruga',
  groom: 'Vinith',
  brideFull: 'Saruga Sivapathy',
  groomFull: 'Vinith Kowrithasan',
  hashtag: '#SaruVinith2026',
  combinedName: 'Saruga & Vinith',
}

export const receptionEvent: WeddingEvent = {
  id: 'reception',
  title: 'Empfang & Feier',
  date: '2026-10-17',
  displayDate: '17. Oktober 2026',
  time: '16:30 Uhr',
  venue: 'Begegnungsstätte Niederkrüchten',
  address: 'Oberkrüchtener Weg 42, 41372 Niederkrüchten',
  description: 'Wir laden euch herzlich zu unserem Empfang ein, um gemeinsam mit euch diesen besonderen Tag zu feiern.',
  lat: 51.196771,
  lng: 6.213148,
}

// Der Reiter „Tamilische Hochzeit 2027" ist bewusst ausgeblendet, bis die Details feststehen.
// Einfach auf true setzen, um ihn auf der Hochzeitsinfos-Seite und der Startseite wieder einzublenden.
export const showTraditionalWeddingTab = false

export const traditionalWedding: WeddingEvent = {
  id: 'traditional',
  title: 'Traditionelle Tamilische Hochzeit',
  date: '2027-01-01',
  displayDate: '2027 – Datum folgt',
  time: 'TBA',
  venue: 'Festhalle – Ort folgt',
  address: 'Adresse wird noch bekanntgegeben',
  description: 'Das große Hochzeitsfest nach tamilischer Tradition wird 2027 stattfinden. Wir geben das genaue Datum noch bekannt.',
}

export const storyTimeline: TimelineItem[] = [
  {
    id: '1',
    year: '15.11.2023',
    title: 'Wo alles begann',
    description: 'Drei Jahre lebte Saruga schon in Mainz, Vinith erst seit einem Jahr – trotzdem brauchte es gemeinsame Freunde und ein kleines bisschen Schicksal, damit sich ihre Wege endlich kreuzten. Der erste Eindruck war denkbar unterschiedlich: Er fand sie ganz schön arrogant und wortkarg, sie hielt ihn für sympathisch, rechnete aber nicht damit, ihn je wiederzusehen. Eine Woche später schrieb er ihr – aus einer Nachricht wurden viele, aus gelegentlichem Schreiben täglicher Kontakt. Ganz langsam begann etwas, von dem beide damals noch nicht ahnten, wohin es einmal führen würde.',
    icon: 'heart',
    align: 'left',
  },
  {
    id: '2',
    year: '07.01.2024',
    title: 'Aus uns wurde Wir',
    description: 'Eine WhatsApp-Nachricht genügte: Hast du am 07.01. Zeit und Lust auf ein Date? Das Timing hätte besser sein können – Saruga war krank und gerade in Saarbrücken. Abgesagt wurde trotzdem nicht. Vinith kam nicht nur zum Date, sondern mit einer kleinen Tüte voller Tee, Wärmekissen und Schokolade im Gepäck – eine Geste, die ihr bis heute im Gedächtnis geblieben ist. Danach ging es gemeinsam nach Frankfurt zu Anjappar, wo bei gutem Essen geredet wurde, bis es draußen dunkel wurde. Als Saruga schließlich den Rückweg vorschlug, hatte Vinith noch etwas vor: Nach einer ziemlich süßen Rede fragte er, ob sie mit ihm zusammen sein möchte. Aus zwei Menschen, die sich wenige Wochen zuvor zufällig kennengelernt hatten, wurde ganz offiziell ein Wir.',
    icon: 'message',
    align: 'right',
  },
  {
    id: '3',
    year: '08.02.2026',
    title: 'Wenn aus zwei Menschen zwei Familien werden',
    description: 'Ende Januar sprachen die Eltern miteinander und entschieden gemeinsam, dass der nächste große Schritt beginnen durfte. Am 08. Februar trafen sich beide Familien zum ersten Mal offiziell bei Vinith zu Hause. Nach tamilischer Tradition brachte die Familie der Braut kunstvoll dekorierte Silbertabletts mit Geschenken mit – Kokosnuss, Blumen, Obst, Kleidung, Süßspeisen und mehr. Die Familie des Bräutigams empfing sie herzlich mit einem festlich geschmückten Empfangstisch, und natürlich wurde ausgiebig gegessen, von der Vorspeise bis zum Dessert. Weil es an diesem Tag gleich doppelt etwas zu feiern gab, durfte auch eine Torte zum bestandenen Masterabschluss des Bräutigams nicht fehlen. Ein Tag voller Traditionen – und der Tag, an dem sich nicht nur zwei Menschen, sondern auch zwei Familien näherkamen.',
    icon: 'family',
    align: 'left',
  },
  {
    id: '4',
    year: '21.03.2026',
    title: 'Nichayathartham',
    description: 'Diesmal besuchte die Familie des Bräutigams die Braut und ihre Familie – auch sie brachte liebevoll vorbereitete Geschenktabletts mit. Nachdem alle Platz genommen hatten, wurde Saruga zum ersten Mal offiziell den Eltern und der ganzen Familie von Vinith vorgestellt. Er kam nicht mit leeren Händen: ein Blumenstrauß für seine zukünftige Braut. Danach wurde gemeinsam gesprochen, gelacht und natürlich wieder ausgiebig gegessen, bevor die Nichayathartham-Torte angeschnitten wurde. Zum Abschluss wurde der ganzen Familie offiziell das Datum ihrer Hochzeit verkündet: der 17. Oktober 2026.',
    icon: 'flower',
    align: 'right',
  },
  {
    id: '5',
    year: '09.07.2026',
    title: 'Die Frage aller Fragen',
    description: 'Eigentlich sollte an diesem Abend nur die bestandene staatliche Pflichtfachprüfung der Braut gefeiert werden. Nach einem schönen Essen ging es weiter in den Deutsch-Französischen Garten – Sonnenuntergang, ein kleiner Spaziergang. So der Plan. Tatsächlich verliefen sich beide gleich zweimal, während in der Ferne plötzlich Lichter und tamilische Musik zu hören waren – und Vinith auffällig ruhig und nervös wurde. Vor einer wunderschön dekorierten Kulisse wurde klar, was hier gerade passierte: Nach und nach kamen die liebsten Menschen hervor – Geschwister, Eltern, Cousinen und Cousins. Der Traumring, die Location, die Dekoration und vor allem die Menschen, die beiden am meisten bedeuten – für Saruga war es der Antrag, den sie sich immer gewünscht hatte. Und die Antwort auf die Frage aller Fragen war natürlich: Ja.',
    icon: 'ring',
    align: 'left',
  },
  {
    id: '6',
    year: '17.10.2026',
    title: 'Unser Ja',
    description: 'Von einem zufälligen ersten Treffen über unzählige Nachrichten, das erste Date, zwei Familien, die zusammenfanden, das Nichayathartham und einen unvergesslichen Antrag – so führt unsere Geschichte hierher. Am 17. Oktober 2026 sagen wir Ja. Doch diese Geschichte gehört nicht nur uns – an diesem Tag seid auch ihr ein Teil davon. Was habt ihr an diesem Tag erlebt, was ist euch besonders in Erinnerung geblieben? Teilt eure Erinnerungen, Gedanken und Lieblingsmomente mit uns auf der Erinnerungen-Seite dieser Website – dann können wir diesen Tag später nicht nur durch unsere, sondern auch durch eure Augen noch einmal erleben.',
    icon: 'certificate',
    align: 'right',
  },
]

export const faqItems: FAQItem[] = [
  {
    id: '1',
    question: 'Wann und wo findet der Empfang statt?',
    answer: 'Der Empfang findet am 17. Oktober 2026 um 16:30 Uhr statt. Die genaue Adresse ist auf der Einladung vermerkt.',
  },
  {
    id: '3',
    question: 'Wann findet die tamilische Hochzeitsfeier statt?',
    answer: 'Die traditionelle tamilische Hochzeitsfeier ist für 2027 geplant. Das genaue Datum werden wir rechtzeitig auf dieser Website und per persönlicher Einladung bekanntgeben.',
  },
  {
    id: '4',
    question: 'Was ist ein tamilisches Hochzeitsritual?',
    answer: 'Eine tamilische Hochzeit ist eine farbenfrohe, mehrstündige Zeremonie mit vielen Ritualen, Musik und Tanz. Die Braut trägt einen prächtigen roten Sari, und es gibt besondere Zeremonien wie das Anlegen des Thaali (Heiratskette). Gäste können traditionelle Kleidung oder festliche westliche Kleidung tragen.',
  },
  {
    id: '6',
    question: 'Sind Kinder willkommen?',
    answer: 'Kinder sind herzlich willkommen! Bitte gebt bei eurer Anmeldung an, ob und wie viele Kinder ihr mitbringt, damit wir entsprechend planen können. Bei der tamilischen Feier 2027 wird es einen eigenen Bereich für die kleinen Gäste geben.',
  },
  {
    id: '7',
    question: 'Wie kann ich meine Teilnahme bestätigen?',
    answer: 'Bitte meldet euch bis zum 1. September 2026 direkt bei uns per E-Mail oder Telefon an. Wir brauchen eure Rückmeldung für die Planung.',
  },
]

// Fotos für das Memory-Spiel (jedes Bild bildet ein Kartenpaar).
// Eigene Fotos hinzufügen: Datei in public/memory-spiel/ ablegen und hier den Pfad eintragen
// (z.B. '/memory-spiel/foto-4.png'). Bis zu 8 Fotos werden genutzt, fehlende Paare
// werden automatisch mit Icons aufgefüllt.
export const memoryGameImages: string[] = [
  '/memory-spiel/memory-1.jpg',
  '/memory-spiel/memory-2.jpg',
  '/memory-spiel/memory-3.jpg',
  '/memory-spiel/memory-4.jpg',
  '/memory-spiel/memory-5.jpg',
  '/memory-spiel/memory-6.jpg',
]

export const quizQuestions: QuizQuestion[] = [
  {
    id: '1',
    question: 'In welcher Stadt haben sich Saruga und Vinith kennengelernt?',
    options: ['Mainz', 'Frankfurt', 'Hamburg', 'Saarbrücken'],
    correctIndex: 0,
  },
  {
    id: '2',
    question: 'Wo war das erste richtige Date von Saruga und Vinith?',
    options: ['Bei ihr zu Hause', 'Im Deutsch-Französischen Garten', 'Bei Anjappar in Frankfurt', 'In einem Café in Mainz'],
    correctIndex: 2,
  },
  {
    id: '3',
    question: 'Wo hat Vinith Saruga einen Antrag gemacht?',
    options: ['Auf Mallorca', 'Im Deutsch-Französischen Garten', 'In Sri Lanka', 'Zuhause'],
    correctIndex: 1,
  },
  {
    id: '4',
    question: 'Wann findet der Empfang statt?',
    options: ['15. Oktober 2026', '17. Oktober 2026', '20. Oktober 2026', '1. November 2026'],
    correctIndex: 1,
  },
  {
    id: '5',
    question: 'Wie lautet der Hochzeits-Hashtag des Paares?',
    options: ['#SaruVinith2026', '#VinithSaru', '#SaruVinithHochzeit', '#WeddingVibes2026'],
    correctIndex: 0,
  },
  {
    id: '6',
    question: 'Was ist ein Thaali?',
    options: ['Ein tamilisches Gericht', 'Ein traditionelles tamilisches Musikinstrument', 'Die Heiratskette bei einer tamilischen Hochzeit', 'Ein tamilisches Tanzstil'],
    correctIndex: 2,
  },
  {
    id: '7',
    question: 'Welche Farbe trägt die Braut traditionell bei einer tamilischen Hochzeit?',
    options: ['Weiß', 'Blau', 'Rot', 'Gold'],
    correctIndex: 2,
  },
  {
    id: '8',
    question: 'In welchem Jahr haben sich Saruga und Vinith kennengelernt?',
    options: ['2021', '2022', '2023', '2024'],
    correctIndex: 2,
  },
]

// "Wer von uns...?" – Gäste stimmen ab, wer von beiden eher zutrifft.
// Die Antwortmöglichkeiten sind für alle Fragen identisch (Braut, Bräutigam, Beide).
export const whoGameOptions: string[] = [couple.bride, couple.groom, 'Beide']

export const whoQuestions: WhoQuestion[] = [
  { id: '1', question: 'Wer hat beim ersten Treffen mehr geredet?' },
  { id: '2', question: 'Wer hatte beim ersten Treffen den besseren ersten Eindruck vom anderen?' },
  { id: '3', question: 'Wer hat zuerst geschrieben?' },
  { id: '4', question: 'Wer braucht länger, um sich fertig zu machen?' },
  { id: '5', question: 'Wer ist romantischer?' },
  { id: '6', question: 'Wer plant lieber alles im Voraus?' },
  { id: '7', question: 'Wer ist spontaner?' },
  { id: '8', question: 'Wer entschuldigt sich nach einem Streit zuerst?' },
  { id: '9', question: 'Wer kann schlechter verlieren?' },
  { id: '10', question: 'Wer klaut dem anderen Essen vom Teller?' },
  { id: '11', question: 'Wer schläft schneller ein?' },
  { id: '12', question: 'Wer ist morgens besser gelaunt?' },
  { id: '13', question: 'Wer ist ordentlicher?' },
  { id: '14', question: 'Wer ist der größere Dickkopf?' },
]

export const galleryImages: GalleryImage[] = [
  {
    id: '1',
    src: 'https://picsum.photos/seed/couple1/800/600',
    alt: 'Saruga und Vinith beim ersten Treffen',
    category: 'Kennenlernen',
    width: 800,
    height: 600,
  },
  {
    id: '2',
    src: 'https://picsum.photos/seed/couple2/600/800',
    alt: 'Romantisches Pärchenfoto',
    category: 'Paarfotos',
    width: 600,
    height: 800,
  },
  {
    id: '3',
    src: 'https://picsum.photos/seed/couple3/800/600',
    alt: 'Verlobungsfeier',
    category: 'Verlobung',
    width: 800,
    height: 600,
  },
  {
    id: '4',
    src: 'https://picsum.photos/seed/couple4/600/800',
    alt: 'Gemeinsame Reise nach Sri Lanka',
    category: 'Paarfotos',
    width: 600,
    height: 800,
  },
  {
    id: '5',
    src: 'https://picsum.photos/seed/couple5/800/800',
    alt: 'Verlobungsring',
    category: 'Verlobung',
    width: 800,
    height: 800,
  },
  {
    id: '6',
    src: 'https://picsum.photos/seed/couple6/800/600',
    alt: 'Sonnenuntergang auf Mallorca',
    category: 'Paarfotos',
    width: 800,
    height: 600,
  },
  {
    id: '7',
    src: 'https://picsum.photos/seed/couple7/600/800',
    alt: 'Verlobungsfeier mit Familie',
    category: 'Verlobung',
    width: 600,
    height: 800,
  },
  {
    id: '8',
    src: 'https://picsum.photos/seed/couple8/800/600',
    alt: 'Tempelbesuch in Sri Lanka',
    category: 'Paarfotos',
    width: 800,
    height: 600,
  },
  {
    id: '9',
    src: 'https://picsum.photos/seed/couple9/800/1000',
    alt: 'Romantisches Abendessen',
    category: 'Paarfotos',
    width: 800,
    height: 1000,
  },
  {
    id: '10',
    src: 'https://picsum.photos/seed/couple10/700/600',
    alt: 'Verlobungsfotos im Park',
    category: 'Verlobung',
    width: 700,
    height: 600,
  },
  {
    id: '11',
    src: 'https://picsum.photos/seed/couple11/800/600',
    alt: 'Gemeinsamer Ausflug',
    category: 'Paarfotos',
    width: 800,
    height: 600,
  },
  {
    id: '12',
    src: 'https://picsum.photos/seed/couple12/600/700',
    alt: 'Familienfeier',
    category: 'Kennenlernen',
    width: 600,
    height: 700,
  },
]

export const mockGuestbookEntries: GuestbookEntry[] = [
  {
    id: '1',
    name: 'Priya & Rajan',
    message: 'Wir sind so glücklich für euch beide! Saruga, du strahlst so sehr, wenn du von Vinith sprichst. Möge eure Liebe ewig dauern und euer Zuhause immer voller Lachen sein. 💕',
    date: '2026-03-15',
    createdAt: new Date('2026-03-15').toISOString(),
  },
  {
    id: '2',
    name: 'Klaus & Ingrid Müller',
    message: 'Lieber Vinith, wir sind so stolz auf dich und so froh, Saruga in unserer Familie willkommen zu heißen. Sie ist ein Schatz! Auf eine wundervolle gemeinsame Zukunft!',
    date: '2026-03-18',
    createdAt: new Date('2026-03-18').toISOString(),
  },
  {
    id: '3',
    name: 'Anjali',
    message: 'Saru, meine liebste Freundin! Ich erinnere mich noch an dein Strahlen, als du mir zum ersten Mal von Vinith erzählt hast. Ich wusste sofort – das ist der Richtige! Herzlichen Glückwunsch ihr Turteltauben! 🌸',
    date: '2026-03-22',
    createdAt: new Date('2026-03-22').toISOString(),
  },
  {
    id: '4',
    name: 'Team Wanderlust',
    message: 'Vinith, du hast uns auf der Sri Lanka Reise immer von Saruga erzählt – wir wussten, dass diese Geschichte so enden würde! Auf viele weitere gemeinsame Abenteuer! ✈️',
    date: '2026-03-28',
    createdAt: new Date('2026-03-28').toISOString(),
  },
  {
    id: '5',
    name: 'Oma Kamala',
    message: 'Mein Herz ist so voll. Saruga, du hast eine wunderbare Familie gefunden. Vinith, pass gut auf sie auf. Möge Gott euren Weg segnen und euch immer Gesundheit, Glück und Liebe schenken. 🙏',
    date: '2026-04-01',
    createdAt: new Date('2026-04-01').toISOString(),
  },
]

export const mockMemories: Memory[] = [
  {
    id: '1',
    name: 'Priya',
    type: 'text',
    content: 'Ich erinnere mich noch genau an den Tag, als Saruga mir von Vinith erzählt hat. Ihre Augen haben so gestrahlt! Das war ein besonderer Moment, den ich nie vergessen werde.',
    date: '2026-03-10',
    createdAt: new Date('2026-03-10').toISOString(),
  },
  {
    id: '2',
    name: 'Marco',
    type: 'text',
    content: 'Vinith hat mich damals angerufen und gefragt, ob der Ring gut ist. "Sie wird ja sagen, oder?" – "Natürlich!" Und er hatte recht. Auf viele weitere glückliche Momente!',
    date: '2026-03-20',
    createdAt: new Date('2026-03-20').toISOString(),
  },
  {
    id: '3',
    name: 'Familie Kowrithasan',
    type: 'text',
    content: 'Wir sind so dankbar, Vinith in unsere Familie aufnehmen zu dürfen. Er hat Sarugas Lächeln zurückgebracht und sie glücklicher gemacht als je zuvor. Willkommen in der Familie, Vinith! 💙',
    date: '2026-03-25',
    createdAt: new Date('2026-03-25').toISOString(),
  },
]

export const navigationItems = [
  { label: 'Startseite', href: '/' },
  { label: 'Unsere Geschichte', href: '/story' },
  { label: 'Hochzeitsinfos', href: '/info' },
  { label: 'Galerie', href: '/gallery' },
  { label: 'Quiz', href: '/quiz' },
  { label: 'Gästespiel', href: '/memory-spiel' },
  { label: 'Erinnerungen', href: '/memories' },
  { label: 'Gästebuch', href: '/guestbook' },
  { label: 'Kontakt', href: '/contact' },
]
