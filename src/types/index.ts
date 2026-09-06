export interface GalleryImage {
  id: string
  src: string
  alt: string
  category: string
  width: number
  height: number
}

export interface GuestbookEntry {
  id: string
  name: string
  message: string
  date: string
  createdAt: string
}

export interface Memory {
  id: string
  name: string
  type: 'text' | 'photo' | 'video'
  content: string
  mediaUrl?: string
  date: string
  createdAt: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export interface TimelineItem {
  id: string
  year: string
  title: string
  description: string
  icon: string
  align: 'left' | 'right'
}

export interface FAQItem {
  id: string
  question: string
  answer: string
}

export interface WhoQuestion {
  id: string
  question: string
}

export interface WhoVoteRecord {
  id: string
  questionId: string
  option: string
  voterName: string
  createdAt: string
}

export interface WeddingEvent {
  id: string
  title: string
  date: string
  displayDate: string
  time: string
  venue: string
  address: string
  description: string
  lat?: number
  lng?: number
}

export interface NavItem {
  label: string
  href: string
}

export interface CountdownTime {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
}
