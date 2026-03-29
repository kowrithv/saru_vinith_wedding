import { GalleryImage, GuestbookEntry, Memory, QuizQuestion, TimelineItem, FAQItem, WeddingEvent } from '@/types'

export const couple = {
  bride: 'Saruga',
  groom: 'Vinith',
  hashtag: '#SaruVinith2026',
  combinedName: 'Saruga & Vinith',
}

export const civilWedding: WeddingEvent = {
  id: 'civil',
  title: 'Standesamtliche Trauung',
  date: '2026-10-17',
  displayDate: '17. Oktober 2026',
  time: '14:00 Uhr',
  venue: 'Standesamt Musterstadt',
  address: 'Rathausplatz 1, 12345 Musterstadt',
  dresscode: 'Festlich – Damen in hellen Farben, Herren im Anzug',
  description: 'Unsere standesamtliche Trauung findet in einem intimen Rahmen mit unseren nächsten Angehörigen statt.',
}

export const traditionalWedding: WeddingEvent = {
  id: 'traditional',
  title: 'Traditionelle Tamilische Hochzeit',
  date: '2027-01-01',
  displayDate: '2027 – Datum folgt',
  time: 'TBA',
  venue: 'Festhalle Musterort',
  address: 'Festhallenstraße 10, 54321 Musterort',
  dresscode: 'Traditionell tamilisch oder festlich westlich',
  description: 'Das große Hochzeitsfest nach tamilischer Tradition wird 2027 stattfinden. Wir geben das genaue Datum noch bekannt.',
}

export const storyTimeline: TimelineItem[] = [
  {
    id: '1',
    year: '2022',
    title: 'Das erste Treffen',
    description: 'Alles begann mit einem zufälligen Treffen auf einem Freundesabend in Hamburg. Vinith und Saruga sprachen stundenlang und merkten schnell, dass sie eine besondere Verbindung haben. Ihre gemeinsamen Interessen für Musik, Reisen und gutes Essen machten es leicht, ins Gespräch zu kommen.',
    icon: 'heart',
    align: 'left',
  },
  {
    id: '2',
    year: '2023',
    title: 'Erste gemeinsame Reise',
    description: 'Ein Jahr nach unserem ersten Kennenlernen reisten wir gemeinsam nach Sri Lanka – Saruga zeigte Vinith die Heimat ihrer Familie, und er verliebte sich sofort in die Kultur, das Essen und natürlich in sie noch mehr. Diese Reise besiegelte unsere Beziehung.',
    icon: 'plane',
    align: 'right',
  },
  {
    id: '3',
    year: '2024',
    title: 'Der Heiratsantrag',
    description: 'Bei einem romantischen Sonnenuntergang auf Mallorca kniete Vinith nieder und fragte Saruga, ob sie ihn heiraten möchte. Mit Tränen der Freude und einem lauten "Ja!" begann ein neues Kapitel unserer Geschichte. Ein Ring, der zwei Kulturen vereint.',
    icon: 'ring',
    align: 'left',
  },
  {
    id: '4',
    year: '17. Oktober 2026',
    title: 'Standesamtliche Trauung',
    description: 'Der offizielle erste Schritt: Wir geben uns das Ja-Wort vor dem deutschen Standesamt, umgeben von unseren engsten Familienmitgliedern und besten Freunden. Ein intimer und bewegender Moment, der uns offiziell zu Mann und Frau macht.',
    icon: 'certificate',
    align: 'right',
  },
  {
    id: '5',
    year: '2027',
    title: 'Tamilische Hochzeitsfeier',
    description: 'Das große Fest! Nach tamilischer Tradition werden wir in einer farbenprächtigen Zeremonie mit Familie und Freunden aus aller Welt unsere Liebe feiern. Traditionelle Musik, wunderschöne Kleidung und köstliches tamilisches Essen erwarten euch.',
    icon: 'celebration',
    align: 'left',
  },
]

export const faqItems: FAQItem[] = [
  {
    id: '1',
    question: 'Wann und wo findet die standesamtliche Trauung statt?',
    answer: 'Die standesamtliche Trauung findet am 17. Oktober 2026 um 14:00 Uhr im Standesamt Musterstadt, Rathausplatz 1, 12345 Musterstadt statt.',
  },
  {
    id: '2',
    question: 'Was soll ich zur standesamtlichen Trauung anziehen?',
    answer: 'Der Dresscode ist festlich. Wir freuen uns, wenn die Damen in hellen Farben erscheinen – Weiß bitte der Braut überlassen! Die Herren sind im Anzug herzlich willkommen.',
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
    id: '5',
    question: 'Gibt es Hotelmöglichkeiten in der Nähe?',
    answer: 'Ja! In der Nähe des Standesamts empfehlen wir das Hotel Stadtpalais (5 min zu Fuß) und das Boutique Hotel am Park (10 min). Bitte reserviert frühzeitig, da die Zimmer begrenzt sind. Sonderpreise für unsere Gäste auf Anfrage.',
  },
  {
    id: '6',
    question: 'Sind Kinder willkommen?',
    answer: 'Kinder sind herzlich willkommen! Bitte gebt bei eurer Anmeldung an, ob und wie viele Kinder ihr mitbringt, damit wir entsprechend planen können. Bei der tamilischen Feier 2027 wird es einen eigenen Bereich für die kleinen Gäste geben.',
  },
  {
    id: '7',
    question: 'Wie kann ich meine Teilnahme bestätigen?',
    answer: 'Bitte meldet euch bis zum 1. September 2026 über das Kontaktformular auf dieser Website oder direkt bei uns per E-Mail oder Telefon an. Wir brauchen eure Rückmeldung für die Planung.',
  },
  {
    id: '8',
    question: 'Können wir ein Hochzeitsgeschenk machen?',
    answer: 'Eure Anwesenheit ist das schönste Geschenk! Falls ihr uns dennoch eine Freude bereiten möchtet, freuen wir uns über einen Beitrag zu unserem Hochzeitsreise-Fond oder einem tamilischen Kochkurs zusammen. Detaillierte Wunschlisten folgen mit der Einladung.',
  },
]

export const quizQuestions: QuizQuestion[] = [
  {
    id: '1',
    question: 'Wo haben sich Saruga und Vinith zum ersten Mal getroffen?',
    options: ['In einem Café in München', 'Auf einem Freundesabend in Hamburg', 'In der Universität', 'Beim Sport'],
    correctIndex: 1,
  },
  {
    id: '2',
    question: 'Wohin reisten Saruga und Vinith für ihre erste gemeinsame Reise?',
    options: ['Nach Indien', 'Nach Sri Lanka', 'Nach Thailand', 'Nach Mallorca'],
    correctIndex: 1,
  },
  {
    id: '3',
    question: 'Wo hat Vinith Saruga um ihre Hand angehalten?',
    options: ['In Hamburg', 'In Sri Lanka', 'Auf Mallorca', 'In Paris'],
    correctIndex: 2,
  },
  {
    id: '4',
    question: 'Wann findet die standesamtliche Trauung statt?',
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
    correctIndex: 1,
  },
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
  { label: 'Erinnerungen', href: '/memories' },
  { label: 'Gästebuch', href: '/guestbook' },
  { label: 'Kontakt', href: '/contact' },
]
