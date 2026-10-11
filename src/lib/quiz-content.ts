export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

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
