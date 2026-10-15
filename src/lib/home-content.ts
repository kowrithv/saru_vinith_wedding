import {
  BookOpen, Calendar, Camera, Gamepad2, MessageSquare, Heart, Trophy, Users2,
  type LucideIcon,
} from 'lucide-react'

export interface HomeFeature {
  icon: LucideIcon
  title: string
  description: string
  href: string
  /**
   * Große Kachel für das, was Gäste zuerst suchen; der Wert ist ihre Farbe
   * (dunkelblau oder champagner). Ohne Angabe ist es eine kompakte Kachel.
   */
  featured?: 'navy' | 'champagne'
  /** Kleine Zeile über dem Titel einer großen Kachel. */
  eyebrow?: string
}

export const homeFeatures: HomeFeature[] = [
  {
    icon: Calendar,
    title: 'Hochzeitsinfos',
    description: 'Ort, Anfahrt, Ablauf des Tages',
    href: '/info',
    featured: 'navy',
    eyebrow: 'Wichtig',
  },
  {
    icon: Camera,
    title: 'Unsere Fotos',
    description: 'Schaut rein und ladet eure eigenen Fotos hoch.',
    href: '/gallery',
    featured: 'champagne',
    eyebrow: 'Galerie',
  },
  {
    icon: BookOpen,
    title: 'Unsere Geschichte',
    description: 'Von einem zufälligen Treffen zu einer großen Liebe – so begann alles.',
    href: '/story',
  },
  {
    icon: Trophy,
    title: 'Quiz',
    description: 'Wie gut kennt ihr uns? Testet euer Wissen in unserem Hochzeitsquiz!',
    href: '/quiz',
  },
  {
    icon: Users2,
    title: 'Wer von uns?',
    description: 'Stimmt ab, wer von uns beiden eher zutrifft. Die Auflösung gibt es bei der Feier.',
    href: '/wer-von-uns',
  },
  {
    icon: Gamepad2,
    title: 'Gästespiel',
    description: 'Spielt unser Liebes-Memory, findet alle Pärchen und schlagt den Rekord aller Gäste!',
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
