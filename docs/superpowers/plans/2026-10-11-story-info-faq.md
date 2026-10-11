# Story/Info/FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die drei statischen Content-Seiten (Story, FAQ, Hochzeitsinfos mit
Anfahrtskarte) mit den echten Inhalten der alten Seite, auf dem
Design-System aus dem vorherigen Plan.

**Architecture:** Jede Seite ist eine eigene Route unter `src/app/<seite>/`.
Inhalte (Zeitleiste, FAQ, Empfangsdaten) liegen als reine TS-Konstanten in
`src/lib/*-content.ts` — direkt im Code, kein CMS. Die Anfahrtskarte
(`VenueMap`) ist eine eigenständige Client-Komponente mit **lokal
gehosteten** Leaflet-Marker-Icons (behebt den CDN-Befund M8 aus dem
Review der alten App).

**Tech Stack:** Next.js App Router · React 19 · Tailwind v4 (Theme aus dem
Design-System-Plan) · framer-motion (Story-Seite) · Leaflet 1.9.4 (Karte) ·
lucide-react (Icons) · Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-rewrite-design.md`

## Global Constraints

- Exakt gepinnt: `leaflet@1.9.4`, `@types/leaflet@1.9.22` (devDependency).
  Keine `^`/`~`-Ranges.
- Leaflets Marker-Icons werden unter `public/leaflet/` selbst gehostet,
  **niemals** von `unpkg.com` oder einem anderen externen CDN geladen.
- Kein „Traditionelle Tamilische Hochzeit 2027"-Tab auf der
  Hochzeitsinfos-Seite in diesem Plan — die alte App hatte dieses Feature
  ohnehin per Konstante (`showTraditionalWeddingTab = false`) deaktiviert,
  und es betrifft 2027, nicht den 17.10.2026. Wird nachgezogen, sobald die
  2027-Details feststehen (eigener, trivialer späterer Task: Datenblock +
  zweite Zeitleiste ergänzen).
- Jede Seite trägt ihre eigene `pt-24 pb-16`-Außenhülle (Konvention aus dem
  vorherigen Plan, siehe Kommentar in `src/app/layout.tsx`) — sonst
  verschwindet der Seitenanfang unter der fixierten Navigation.
- Inhalte sind 1:1 aus der alten Seite übernommen (als Text, nicht als
  Code). **Bekannte Alt-Information:** Die FAQ-Antwort zur Anmeldefrist
  nennt „bis zum 1. September 2026" — das Datum ist aus Sicht von heute
  (11.10.2026) bereits vergangen. Wird unverändert übernommen und am Ende
  dieses Plans explizit an den Nutzer zurückgemeldet, nicht selbst
  „korrigiert" (das korrekte neue Datum ist eine inhaltliche
  Nutzer-Entscheidung, keine Code-Entscheidung).
- TDD ist Pflicht für jede Komponente mit eigener Logik (Accordion-Toggle,
  VenueMap-Links). Reine Darstellungs-/Inhaltsdateien ohne Logik bekommen
  trotzdem einen Rendering-Test pro Seite.

## Review Focus

- `VenueMap`s beide Richtungs-Links (Google Maps, OpenStreetMap) müssen
  aus `lat`/`lng`/`label`/`address` korrekt berechnet werden, **auch wenn**
  die eigentliche Leaflet-Karte nicht lädt (z. B. Kartenserver down) — ein
  Gast muss trotzdem auf „Route planen" tippen können.
- Das FAQ-Akkordeon darf nie zwei Antworten gleichzeitig offen zeigen —
  das Öffnen einer Frage muss die vorher offene schließen.
- Leaflets Marker-Icons müssen von der eigenen Origin (`/leaflet/...`)
  aufgelöst werden, nie von einem externen Host.
- Die Story-Zeitleiste muss alle sechs Einträge in Datenreihenfolge
  rendern, nicht nach einem hartkodierten Index.
- Jede der drei Seiten muss ihre eigene `pt-24`-Außenhülle mitbringen —
  eine vergessene Seite würde unter der fixierten Navigation verschwinden
  (exakt der Bug, der im vorherigen Plan gefunden und behoben wurde).

---

## Task 1: Story-Inhalte & Seite

**Files:**
- Create: `src/lib/story-content.ts`
- Create: `src/app/story/page.tsx`
- Test: `src/app/story/page.test.tsx`

**Interfaces:**
- Produces: `storyTimeline: TimelineItem[]`,
  `interface TimelineItem { id, year, title, description, icon, align }`.
  Nur von `src/app/story/page.tsx` konsumiert.

- [ ] **Step 1: Inhalte anlegen**

```ts
// src/lib/story-content.ts
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
```

- [ ] **Step 2: Test für die Story-Seite schreiben**

```tsx
// src/app/story/page.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import StoryPage from './page'
import { storyTimeline } from '@/lib/story-content'

describe('StoryPage', () => {
  it('renders every timeline entry in data order with its year and title', () => {
    render(<StoryPage />)
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings).toHaveLength(storyTimeline.length)
    headings.forEach((heading, index) => {
      expect(heading).toHaveTextContent(storyTimeline[index].title)
    })
    storyTimeline.forEach((item) => {
      expect(screen.getByText(item.year)).toBeInTheDocument()
    })
  })

  it('renders the closing message', () => {
    render(<StoryPage />)
    expect(screen.getByText('Das Beste kommt noch')).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<StoryPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/story/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 4: Seite implementieren**

```tsx
// src/app/story/page.tsx
'use client'

import { motion } from 'framer-motion'
import {
  Heart,
  MessageCircle,
  Users,
  Flower2,
  Gem,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import { storyTimeline, type TimelineIcon } from '@/lib/story-content'

const iconMap: Record<TimelineIcon, LucideIcon> = {
  heart: Heart,
  message: MessageCircle,
  family: Users,
  flower: Flower2,
  ring: Gem,
  certificate: FileText,
}

export default function StoryPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Unsere Geschichte"
          subtitle="Jede große Liebe beginnt mit einer kleinen Geschichte. Dies ist unsere."
        />

        <div className="relative mt-12">
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-champagne-dark via-gold/30 to-champagne-dark" />

          <div className="space-y-12 md:space-y-0">
            {storyTimeline.map((item) => {
              const IconComponent = iconMap[item.icon]
              const isLeft = item.align === 'left'

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5 }}
                  className={`relative md:flex md:items-center ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} md:gap-8 mb-12`}
                >
                  <div className={`md:w-[calc(50%-3rem)] ${isLeft ? 'md:text-right' : 'md:text-left'}`}>
                    <div
                      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 ${
                        isLeft ? 'md:ml-auto' : 'md:mr-auto'
                      }`}
                    >
                      <div className={`flex items-center gap-2 mb-3 ${isLeft ? 'md:justify-end' : 'justify-start'}`}>
                        <span className="inline-block px-3 py-1 bg-champagne text-dark-blue text-xs font-semibold rounded-full uppercase tracking-wider">
                          {item.year}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl font-semibold text-dark-blue mb-3">
                        {item.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-14 h-14 bg-white border-4 border-champagne rounded-full items-center justify-center shadow-md z-10">
                    <IconComponent size={20} className="text-dark-blue" />
                  </div>

                  <div className="md:hidden flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-champagne rounded-full flex items-center justify-center flex-shrink-0">
                      <IconComponent size={18} className="text-dark-blue" />
                    </div>
                    <div className="h-px flex-1 bg-champagne-dark/40" />
                  </div>

                  <div className="hidden md:block md:w-[calc(50%-3rem)]" />
                </motion.div>
              )
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mt-16"
        >
          <div className="inline-block bg-dark-blue text-white rounded-2xl px-8 py-8 max-w-lg mx-auto">
            <Heart size={28} className="text-gold fill-gold mx-auto mb-4" />
            <p className="font-serif text-xl font-semibold mb-3">Das Beste kommt noch</p>
            <p className="text-white/70 text-sm leading-relaxed">
              Unsere Geschichte ist noch nicht zu Ende – sie fängt gerade erst an.
              Wir freuen uns darauf, sie gemeinsam mit euch zu schreiben.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/story/page.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 6: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 7: Commit**

```bash
git add src/lib/story-content.ts src/app/story/page.tsx src/app/story/page.test.tsx
git commit -m "Add Story page with the couple's real timeline"
```

---

## Task 2: FAQ-Inhalte & Seite

**Files:**
- Create: `src/lib/faq-content.ts`
- Create: `src/app/faq/page.tsx`
- Test: `src/app/faq/page.test.tsx`

**Interfaces:**
- Produces: `faqItems: FAQItem[]`,
  `interface FAQItem { id, question, answer }`. Nur von
  `src/app/faq/page.tsx` konsumiert.

- [ ] **Step 1: Inhalte anlegen**

```ts
// src/lib/faq-content.ts
export interface FAQItem {
  id: string
  question: string
  answer: string
}

export const faqItems: FAQItem[] = [
  {
    id: '1',
    question: 'Wann und wo findet der Empfang statt?',
    answer:
      'Der Empfang findet am 17. Oktober 2026 um 16:30 Uhr statt. Die genaue Adresse ist auf der Einladung vermerkt.',
  },
  {
    id: '2',
    question: 'Wann findet die tamilische Hochzeitsfeier statt?',
    answer:
      'Die traditionelle tamilische Hochzeitsfeier ist für 2027 geplant. Das genaue Datum werden wir rechtzeitig auf dieser Website und per persönlicher Einladung bekanntgeben.',
  },
  {
    id: '3',
    question: 'Was ist ein tamilisches Hochzeitsritual?',
    answer:
      'Eine tamilische Hochzeit ist eine farbenfrohe, mehrstündige Zeremonie mit vielen Ritualen, Musik und Tanz. Die Braut trägt einen prächtigen roten Sari, und es gibt besondere Zeremonien wie das Anlegen des Thaali (Heiratskette). Gäste können traditionelle Kleidung oder festliche westliche Kleidung tragen.',
  },
  {
    id: '4',
    question: 'Sind Kinder willkommen?',
    answer:
      'Kinder sind herzlich willkommen! Bitte gebt bei eurer Anmeldung an, ob und wie viele Kinder ihr mitbringt, damit wir entsprechend planen können. Bei der tamilischen Feier 2027 wird es einen eigenen Bereich für die kleinen Gäste geben.',
  },
  {
    id: '5',
    question: 'Wie kann ich meine Teilnahme bestätigen?',
    answer:
      'Bitte meldet euch bis zum 1. September 2026 direkt bei uns per E-Mail oder Telefon an. Wir brauchen eure Rückmeldung für die Planung.',
  },
]
```

- [ ] **Step 2: Test schreiben**

```tsx
// src/app/faq/page.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FAQPage from './page'
import { faqItems } from '@/lib/faq-content'

describe('FAQPage', () => {
  it('renders every question', () => {
    render(<FAQPage />)
    faqItems.forEach((item) => {
      expect(screen.getByText(item.question)).toBeInTheDocument()
    })
  })

  it('shows the first answer open by default', () => {
    render(<FAQPage />)
    expect(screen.getByText(faqItems[0].answer)).toBeInTheDocument()
  })

  it('opens a closed question and shows its answer', async () => {
    render(<FAQPage />)
    await userEvent.click(screen.getByText(faqItems[1].question))
    expect(screen.getByText(faqItems[1].answer)).toBeInTheDocument()
  })

  it('closes the previously open answer when another question opens', async () => {
    render(<FAQPage />)
    await userEvent.click(screen.getByText(faqItems[1].question))
    expect(screen.queryByText(faqItems[0].answer)).not.toBeInTheDocument()
  })

  it('collapses an open question when clicked again', async () => {
    render(<FAQPage />)
    await userEvent.click(screen.getByText(faqItems[0].question))
    expect(screen.queryByText(faqItems[0].answer)).not.toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<FAQPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/faq/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 4: Seite implementieren**

```tsx
// src/app/faq/page.tsx
'use client'

import { useState } from 'react'
import { Plus, Minus, HelpCircle } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import { faqItems } from '@/lib/faq-content'
import { cn } from '@/lib/utils'

interface AccordionItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

function AccordionItem({ question, answer, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        isOpen ? 'border-dark-blue/20 bg-dark-blue/[0.02] shadow-sm' : 'border-gray-100 bg-white'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            'font-medium text-sm md:text-base leading-snug',
            isOpen ? 'text-dark-blue' : 'text-gray-800'
          )}
        >
          {question}
        </span>
        <span
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
            isOpen ? 'bg-dark-blue' : 'bg-gray-100'
          )}
        >
          {isOpen ? <Minus size={14} className="text-white" /> : <Plus size={14} className="text-gray-600" />}
        </span>
      </button>

      {isOpen && (
        <div className="px-6 pb-5">
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null)

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Häufige Fragen"
          subtitle="Hier findet ihr Antworten auf die wichtigsten Fragen rund um unsere Hochzeit."
        />

        <div className="flex items-center gap-3 bg-champagne/40 rounded-2xl p-4 mb-8 border border-champagne-dark/20">
          <HelpCircle size={20} className="text-dark-blue flex-shrink-0" />
          <p className="text-sm text-dark-blue">
            Noch weitere Fragen? Schreibt uns einfach eine{' '}
            <a href="mailto:hallo@saru-vinith.de" className="font-semibold underline underline-offset-2">
              E-Mail
            </a>
            , wir antworten gerne!
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item) => (
            <AccordionItem
              key={item.id}
              question={item.question}
              answer={item.answer}
              isOpen={openId === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/faq/page.test.tsx`
Expected: PASS (6/6)

- [ ] **Step 6: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 7: Commit**

```bash
git add src/lib/faq-content.ts src/app/faq/page.tsx src/app/faq/page.test.tsx
git commit -m "Add FAQ page with accordion"
```

---

## Task 3: Venue-Karte (Leaflet, lokale Marker-Icons)

**Files:**
- Create: `public/leaflet/marker-icon.png`
- Create: `public/leaflet/marker-icon-2x.png`
- Create: `public/leaflet/marker-shadow.png`
- Create: `src/components/sections/VenueMap.tsx`
- Test: `src/components/sections/VenueMap.test.tsx`

**Interfaces:**
- Produces: `<VenueMap lat lng label address />`. Von
  `src/app/info/page.tsx` (Task 4) konsumiert.

- [ ] **Step 1: Leaflet installieren und Marker-Icons lokal kopieren**

```bash
npm install leaflet@1.9.4
npm install -D @types/leaflet@1.9.22
mkdir -p public/leaflet
cp node_modules/leaflet/dist/images/marker-icon.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-icon-2x.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-shadow.png public/leaflet/
```

Diese drei PNGs werden ins Repo committet (Step 7) — damit lädt die Karte
ihre Marker-Icons immer von der eigenen Origin, nie von einem externen
CDN (behebt den entsprechenden Befund aus dem alten Review).

- [ ] **Step 2: Test schreiben — die beiden Richtungs-Links**

```tsx
// src/components/sections/VenueMap.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import VenueMap from './VenueMap'

const mergeOptions = vi.fn()

vi.mock('leaflet', () => ({
  default: {
    Icon: { Default: { mergeOptions, prototype: {} } },
    map: vi.fn(() => ({ remove: vi.fn() })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => ({
      addTo: vi.fn(() => ({ bindPopup: vi.fn(() => ({ openPopup: vi.fn() })) })),
    })),
  },
}))

describe('VenueMap', () => {
  const props = {
    lat: 51.196771,
    lng: 6.213148,
    label: 'Begegnungsstätte Niederkrüchten',
    address: 'Oberkrüchtener Weg 42, 41372 Niederkrüchten',
  }

  it('links to Google Maps directions with the correct coordinates', () => {
    render(<VenueMap {...props} />)
    const link = screen.getByRole('link', { name: /Route planen/i })
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=51.196771,6.213148'
    )
  })

  it('links to OpenStreetMap with the correct coordinates', () => {
    render(<VenueMap {...props} />)
    const link = screen.getByRole('link', { name: /OpenStreetMap/i })
    expect(link).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=51.196771&mlon=6.213148#map=17/51.196771/6.213148'
    )
  })

  it('configures Leaflet marker icons from the app origin, never an external CDN', async () => {
    render(<VenueMap {...props} />)
    await waitFor(() => expect(mergeOptions).toHaveBeenCalled())
    const options = mergeOptions.mock.calls[0][0]
    expect(options.iconUrl).toBe('/leaflet/marker-icon.png')
    expect(options.iconRetinaUrl).toBe('/leaflet/marker-icon-2x.png')
    expect(options.shadowUrl).toBe('/leaflet/marker-shadow.png')
    ;[options.iconUrl, options.iconRetinaUrl, options.shadowUrl].forEach((url) => {
      expect(url.startsWith('http')).toBe(false)
    })
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/sections/VenueMap.test.tsx`
Expected: FAIL — `Cannot find module './VenueMap'`

- [ ] **Step 4: `VenueMap` implementieren**

```tsx
// src/components/sections/VenueMap.tsx
'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigation as NavigationIcon, MapPinned } from 'lucide-react'

interface VenueMapProps {
  lat: number
  lng: number
  label: string
  address: string
}

const buttonClasses =
  'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 active:scale-[0.98] text-sm px-6 py-2.5'

export default function VenueMap({ lat, lng, label, address }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`

  useEffect(() => {
    let cancelled = false

    import('leaflet').then((leafletModule) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const L = leafletModule.default

      // Next.js/Webpack löst Leaflets eingebaute Icon-URL-Auflösung nicht
      // auf - deaktivieren und stattdessen die lokal gehosteten PNGs aus
      // public/leaflet/ direkt angeben (nie ein externes CDN).
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      })

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>-Mitwirkende',
        maxZoom: 19,
      }).addTo(map)

      L.marker([lat, lng]).addTo(map).bindPopup(`<strong>${label}</strong><br/>${address}`).openPopup()
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng, label, address])

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      <div ref={containerRef} className="w-full h-64 md:h-80" />
      <div className="flex flex-col sm:flex-row gap-3 p-4">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClasses} bg-dark-blue text-white hover:bg-dark-blue-light shadow-md hover:shadow-lg flex-1`}
        >
          <NavigationIcon size={16} />
          Route planen
        </a>
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClasses} border-2 border-dark-blue text-dark-blue hover:bg-dark-blue hover:text-white flex-1`}
        >
          <MapPinned size={16} />
          Auf OpenStreetMap ansehen
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/sections/VenueMap.test.tsx`
Expected: PASS (3/3) — der echte Leaflet-Aufbau (Kacheln, Marker-Rendering
auf echten Tiles) ist gemockt und wird hier bewusst **nicht** geprüft;
das ist Sache des manuellen Gerätetests vor dem Freeze (Spec Abschnitt
„Teststrategie"). Geprüft wird aber sehr wohl, mit welchen Icon-URLs
Leaflet konfiguriert wird — das belegt den Review-Focus-Punkt zu den
lokal gehosteten Markern.

- [ ] **Step 6: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json public/leaflet/marker-icon.png \
  public/leaflet/marker-icon-2x.png public/leaflet/marker-shadow.png \
  src/components/sections/VenueMap.tsx src/components/sections/VenueMap.test.tsx
git commit -m "Add VenueMap with self-hosted Leaflet marker icons"
```

---

## Task 4: Hochzeitsinfos-Seite

**Files:**
- Create: `src/lib/event-info.ts`
- Create: `src/app/info/page.tsx`
- Test: `src/app/info/page.test.tsx`

**Interfaces:**
- Consumes: `VenueMap` (Task 3), `Card` (vorheriger Plan).
- Produces: `receptionEvent`, `receptionSchedule: ScheduleItem[]`. Nur von
  `src/app/info/page.tsx` konsumiert.

- [ ] **Step 1: Inhalte anlegen**

```ts
// src/lib/event-info.ts
export const receptionEvent = {
  title: 'Empfang & Feier',
  displayDate: '17. Oktober 2026',
  time: '16:30 Uhr',
  venue: 'Begegnungsstätte Niederkrüchten',
  address: 'Oberkrüchtener Weg 42, 41372 Niederkrüchten',
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
```

- [ ] **Step 2: Test schreiben (VenueMap gemockt)**

```tsx
// src/app/info/page.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import InfoPage from './page'
import { receptionEvent, receptionSchedule } from '@/lib/event-info'

vi.mock('@/components/sections/VenueMap', () => ({
  default: () => <div data-testid="venue-map-stub" />,
}))

describe('InfoPage', () => {
  it('renders date, time, venue and address', () => {
    render(<InfoPage />)
    expect(screen.getByText(receptionEvent.displayDate)).toBeInTheDocument()
    expect(screen.getByText(receptionEvent.time)).toBeInTheDocument()
    expect(screen.getByText(receptionEvent.venue)).toBeInTheDocument()
    expect(screen.getByText(receptionEvent.address)).toBeInTheDocument()
  })

  it('renders every schedule item', () => {
    render(<InfoPage />)
    receptionSchedule.forEach((item) => {
      expect(screen.getByText(item.event)).toBeInTheDocument()
    })
  })

  it('renders the venue map', () => {
    render(<InfoPage />)
    expect(screen.getByTestId('venue-map-stub')).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<InfoPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/info/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 4: Seite implementieren**

```tsx
// src/app/info/page.tsx
import { Calendar, Clock, MapPin, Car, Info as InfoIcon, type LucideIcon } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import VenueMap from '@/components/sections/VenueMap'
import { receptionEvent, receptionSchedule } from '@/lib/event-info'

interface InfoCardProps {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
}

function InfoCard({ icon: Icon, label, value, sublabel }: InfoCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="w-10 h-10 bg-champagne rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-dark-blue" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-semibold text-dark-blue">{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}

export default function InfoPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Hochzeitsinfos"
          subtitle="Alles was ihr wissen müsst – von Uhrzeit bis Parkplätze."
        />

        <Card variant="dark" padding="lg" className="mb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calendar size={26} className="text-champagne" />
            </div>
            <div>
              <p className="text-champagne/60 text-xs font-medium uppercase tracking-wider">
                {receptionEvent.displayDate}
              </p>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-white">
                {receptionEvent.title}
              </h2>
              <p className="text-white/70 text-sm mt-1">{receptionEvent.description}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <InfoCard icon={Calendar} label="Datum" value={receptionEvent.displayDate} />
          <InfoCard icon={Clock} label="Uhrzeit" value={receptionEvent.time} />
          <InfoCard icon={MapPin} label="Ort" value={receptionEvent.venue} sublabel={receptionEvent.address} />
          <InfoCard icon={Car} label="Parken" value="Parkplätze direkt an der Begegnungsstätte" />
        </div>

        <div className="mb-8">
          <VenueMap
            lat={receptionEvent.lat}
            lng={receptionEvent.lng}
            label={receptionEvent.venue}
            address={receptionEvent.address}
          />
        </div>

        <Card padding="lg">
          <h3 className="font-serif text-xl font-semibold text-dark-blue mb-5 flex items-center gap-2">
            <InfoIcon size={18} className="text-gold" />
            Ablauf des Tages
          </h3>
          <div className="space-y-4">
            {receptionSchedule.map((item, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="text-xs font-semibold text-gold bg-champagne px-2 py-1 rounded-full">
                    {item.time}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-2 h-2 bg-dark-blue rounded-full flex-shrink-0" />
                  <p className="text-sm text-gray-700">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/info/page.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 6: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün.

- [ ] **Step 7: Commit**

```bash
git add src/lib/event-info.ts src/app/info/page.tsx src/app/info/page.test.tsx
git commit -m "Add wedding info page with venue map and schedule"
```

---

## Abschluss

Nach Task 4 sind Story, FAQ und Hochzeitsinfos live, erreichbar über die
bereits bestehende Navigation. Alle drei nutzen das Design-System aus dem
vorherigen Plan und folgen der `pt-24`-Konvention. Übrig bleibt für den
Nutzer: die Anmeldefrist in der FAQ (aktuell „1. September 2026",
inzwischen vergangen) auf ein neues Datum zu aktualisieren — das ist eine
inhaltliche Entscheidung, keine, die dieser Plan selbst trifft.
