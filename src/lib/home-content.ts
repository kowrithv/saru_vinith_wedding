import {
  BookOpen, Calendar, Camera, Gamepad2, MessageSquare, Heart, Trophy,
  type LucideIcon,
} from 'lucide-react'

export interface HomeFeature {
  icon: LucideIcon
  title: string
  description: string
  href: string
}

export const homeFeatures: HomeFeature[] = [
  {
    icon: BookOpen,
    title: 'Unsere Geschichte',
    description: 'Von einem zufälligen Treffen zu einer großen Liebe – so begann alles.',
    href: '/story',
  },
  {
    icon: Calendar,
    title: 'Hochzeitsinfos',
    description: 'Datum, Uhrzeit, Ort und Ablauf des Empfangs auf einen Blick.',
    href: '/info',
  },
  {
    icon: Camera,
    title: 'Galerie',
    description: 'Fotos von uns und von eurem Tag – schaut rein und ladet eure eigenen hoch.',
    href: '/gallery',
  },
  {
    icon: Trophy,
    title: 'Quiz',
    description: 'Wie gut kennt ihr uns? Testet euer Wissen in unserem Hochzeitsquiz!',
    href: '/quiz',
  },
  {
    icon: Gamepad2,
    title: 'Gästespiel',
    description: 'Spielt unser Liebes-Memory und findet alle Pärchen – mit Bestzeit!',
    href: '/memory-spiel',
  },
  {
    icon: Heart,
    title: 'Erinnerungen',
    description: 'Teilt eure Erinnerungen an uns und diesen Tag.',
    href: '/memories',
  },
  {
    icon: MessageSquare,
    title: 'Gästebuch',
    description: 'Hinterlasst uns eine Nachricht und seid Teil unserer Geschichte.',
    href: '/guestbook',
  },
]
