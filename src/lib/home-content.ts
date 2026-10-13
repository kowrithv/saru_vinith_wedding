import {
  BookOpen, Calendar, Camera, Gamepad2, MessageSquare, Heart, Trophy,
  type LucideIcon,
} from 'lucide-react'

export interface HomeFeature {
  icon: LucideIcon
  title: string
  description: string
  /** Handlungsaufforderung der Kachel (statt überall "Mehr erfahren"). */
  cta: string
  href: string
}

export const homeFeatures: HomeFeature[] = [
  {
    icon: BookOpen,
    title: 'Unsere Geschichte',
    description: 'Von einem zufälligen Treffen zu einer großen Liebe – so begann alles.',
    cta: 'Geschichte lesen',
    href: '/story',
  },
  {
    icon: Calendar,
    title: 'Hochzeitsinfos',
    description: 'Datum, Uhrzeit, Ort und Ablauf des Empfangs auf einen Blick.',
    cta: 'Infos ansehen',
    href: '/info',
  },
  {
    icon: Camera,
    title: 'Galerie',
    description: 'Fotos von uns und von eurem Tag – schaut rein und ladet eure eigenen hoch.',
    cta: 'Fotos ansehen',
    href: '/gallery',
  },
  {
    icon: Trophy,
    title: 'Quiz',
    description: 'Wie gut kennt ihr uns? Testet euer Wissen in unserem Hochzeitsquiz!',
    cta: 'Quiz starten',
    href: '/quiz',
  },
  {
    icon: Gamepad2,
    title: 'Gästespiel',
    description: 'Spielt unser Liebes-Memory, findet alle Pärchen und schlagt den Rekord aller Gäste!',
    cta: 'Jetzt spielen',
    href: '/memory-spiel',
  },
  {
    icon: Heart,
    title: 'Erinnerungen',
    description: 'Teilt eure Erinnerungen an uns und diesen Tag.',
    cta: 'Erinnerung teilen',
    href: '/memories',
  },
  {
    icon: MessageSquare,
    title: 'Gästebuch',
    description: 'Hinterlasst uns eine Nachricht und seid Teil unserer Geschichte.',
    cta: 'Eintrag schreiben',
    href: '/guestbook',
  },
]
