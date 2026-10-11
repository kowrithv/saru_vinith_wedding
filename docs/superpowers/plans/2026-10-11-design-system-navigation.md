# Design-System & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das visuelle Design der alten Seite (Farben, Fonts, Grundkomponenten)
im neuen Tailwind-v4-Setup nachbilden, plus eine vereinfachte, sichere
Navigation/Footer — die Grundlage, auf der die Story/Info/FAQ-Seiten (und
später alle weiteren Seiten) aufbauen.

**Architecture:** Farben/Fonts als Tailwind-v4-`@theme`-Tokens in
`globals.css` (kein separates `tailwind.config.ts` nötig). Zwei
Grundkomponenten (`SectionTitle`, `Card`) für wiederkehrende Layout-Muster.
Navigation und Footer sind rein statisch — keine DB-Abfrage für
Seiten-Sichtbarkeit (gibt es in der neuen Architektur nicht mehr) und kein
`/admin`-Link (Sicherheitsbefund aus dem Review der alten App).

**Tech Stack:** Next.js 16 App Router · Tailwind CSS 4 (`@theme` statt
`tailwind.config.ts`) · `next/font/google` (Playfair Display, Inter) ·
framer-motion · lucide-react · clsx + tailwind-merge.

**Spec:** `docs/superpowers/specs/2026-10-11-rewrite-design.md` (Abschnitt
„Leitprinzip: 1 Usage, kein Produkt" — keine Laufzeit-Sichtbarkeitssteuerung)

## Global Constraints

- Exakt gepinnte Kernversionen (bereits in `package.json` aus dem
  Grundgerüst-Plan): `next@16.4.0`, `react@19.3.0`, `typescript@6.0.3`,
  `tailwindcss@4.3.3`. Neue Pakete in diesem Plan ebenfalls exakt pinnen,
  keine `^`/`~`-Ranges.
- TDD ist Pflicht für jede Komponente mit Logik (Navigation, Footer, `cn`).
  Rein deklarative Darstellungskomponenten ohne eigene Logik (`SectionTitle`,
  `Card`) bekommen trotzdem einen Rendering-Test — „zeigt die übergebenen
  Props korrekt an" ist eine testbare Behauptung.
- Kein Code aus der alten App übernehmen — Navigation/Footer werden aus der
  alten Datei nur als **Verhaltens-Referenz** gelesen, nicht kopiert, und
  dabei bewusst vereinfacht (siehe unten).
- **Kein `/admin`-Link** in Footer oder Navigation (Sicherheitsbefund K2 aus
  dem alten Review: der Admin-Bereich soll nicht über einen öffentlichen
  Link auffindbar sein).
- **Keine Laufzeit-Sichtbarkeitsabfrage** (kein `fetch('/api/settings')` in
  Navigation/Footer) — es gibt in der neuen Architektur keine generische
  Seiten-Sichtbarkeitssteuerung. Die Nav-Liste ist eine statische Konstante.
- Deutsche Oberflächentexte.

## Review Focus

- Der Footer darf unter keinen Umständen einen Link auf `/admin` rendern —
  das war in der alten App ein öffentlich auffindbarer Einstiegspunkt zum
  Admin-Bereich.
- Navigation und Footer dürfen keinen Netzwerk-Request auslösen, um zu
  entscheiden, welche Links sichtbar sind — sie müssen vollständig synchron
  und ohne Ladezustand rendern.
- Das mobile Menü muss sich automatisch schließen, wenn sich die Route
  ändert (sonst bleibt die Overlay-Navigation nach einem Linkklick offen
  stehen).
- Die aktive Seite muss in der Navigation optisch erkennbar sein — ein
  falsch berechneter „aktiv"-Zustand verwirrt auf einer so kleinen Seite
  sofort.
- `cn()` muss widersprüchliche Tailwind-Klassen wirklich auflösen (z. B.
  zwei verschiedene `p-*`-Klassen), nicht nur aneinanderhängen — sonst
  gewinnt im Zweifel die falsche Klasse in der späteren Praxis.

---

## Task 1: Tailwind-Theme (Farben & Fonts)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind-Utility-Klassen `bg-champagne(-light|-dark)`,
  `bg-baby-blue(-light|-dark)`, `bg-dark-blue(-light|-dark)`,
  `bg-gold(-light|-dark)` (und die entsprechenden `text-*`/`border-*`-Varianten),
  sowie `font-serif`/`font-sans`. Jede spätere Komponente in diesem und
  folgenden Plänen nutzt ausschließlich diese Klassen für Farben/Fonts.

Dieser Task hat keinen eigenen automatisierten Test — Tailwinds `@theme`
generiert nur CSS-Utility-Klassen, es gibt keine Laufzeitlogik zu prüfen.
Verifiziert wird über den Produktions-Build (Schritt 3) und eine visuelle
Kontrolle der Startseite.

- [ ] **Step 1: `@theme`-Block in `globals.css` ergänzen**

```css
@import "tailwindcss";

@theme {
  --font-serif: var(--font-playfair), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;

  --color-champagne: #f5e6c8;
  --color-champagne-light: #faf0dc;
  --color-champagne-dark: #e8d5b7;

  --color-baby-blue: #b8d4e8;
  --color-baby-blue-light: #d4e8f5;
  --color-baby-blue-dark: #a0bfda;

  --color-dark-blue: #1e3a5f;
  --color-dark-blue-light: #2c4f7c;
  --color-dark-blue-dark: #152940;

  --color-gold: #c9a84c;
  --color-gold-light: #d4b96a;
  --color-gold-dark: #a8892e;
}
```

- [ ] **Step 2: Fonts in `layout.tsx` einbinden**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Saruga & Vinith',
  description: 'Alles rund um unsere Hochzeit am 17. Oktober 2026.',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="de" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-sans antialiased bg-white text-gray-900">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Build prüfen**

Run: `npm run build`
Expected: läuft fehlerfrei durch (gleiche bekannte, akzeptierte
Turbopack-Edge-Runtime-Warnung aus dem Grundgerüst-Plan, sonst keine neuen
Fehler/Warnungen).

- [ ] **Step 4: Bestehende Tests laufen lassen**

Run: `npm test`
Expected: alle bisherigen Tests (aus dem Grundgerüst-Plan) weiterhin grün —
dieser Task ändert nur CSS/Fonts, keine Komponenten-Logik.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "Add Tailwind v4 theme tokens and Google fonts from the old design"
```

---

## Task 2: `cn()`-Utility

**Files:**
- Create: `src/lib/utils.ts`
- Test: `src/lib/utils.test.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`. Jede Komponente in
  diesem Plan (und allen folgenden) nutzt `cn()` für bedingte
  Tailwind-Klassen.

- [ ] **Step 1: Paket installieren**

```bash
npm install clsx@2.1.1 tailwind-merge@3.7.0
```

- [ ] **Step 2: Test schreiben**

```ts
// src/lib/utils.test.ts
import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins multiple class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves conflicting Tailwind utilities, keeping the last one', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('applies conditional classes based on a boolean', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL — `Cannot find module './utils'`

- [ ] **Step 4: Implementierung**

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: PASS (4/4)

- [ ] **Step 6: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/utils.ts src/lib/utils.test.ts
git commit -m "Add the cn() class-merging utility"
```

---

## Task 3: Statische Inhalte (Paar-Daten, Navigationsliste)

**Files:**
- Create: `src/lib/site-content.ts`

**Interfaces:**
- Produces: `couple: { bride, groom, brideFull, groomFull, hashtag,
  combinedName }`, `navigationItems: { label: string; href: string }[]`.
  Navigation und Footer (Task 5/6) sowie spätere Seiten-Pläne importieren
  beides.

Reine Konstantendaten ohne Logik — kein sinnvoller automatisierter Test
(„ist dieses Array gleich sich selbst" prüft nichts). Verifiziert wird
indirekt über die Navigation/Footer-Tests in Task 5/6, die diese Daten
rendern.

- [ ] **Step 1: Datei anlegen**

```ts
// src/lib/site-content.ts
export const couple = {
  bride: 'Saruga',
  groom: 'Vinith',
  brideFull: 'Saruga Sivapathy',
  groomFull: 'Vinith Kowrithasan',
  hashtag: '#SaruVinith2026',
  combinedName: 'Saruga & Vinith',
}

export interface NavigationItem {
  label: string
  href: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Startseite', href: '/' },
  { label: 'Unsere Geschichte', href: '/story' },
  { label: 'Hochzeitsinfos', href: '/info' },
  { label: 'Galerie', href: '/gallery' },
  { label: 'Quiz', href: '/quiz' },
  { label: 'Gästespiel', href: '/memory-spiel' },
  { label: 'Erinnerungen', href: '/memories' },
  { label: 'Gästebuch', href: '/guestbook' },
]
```

- [ ] **Step 2: Typecheck/Lint prüfen**

Run: `npm run typecheck && npm run lint`
Expected: beide grün

- [ ] **Step 3: Commit**

```bash
git add src/lib/site-content.ts
git commit -m "Add static couple info and navigation list"
```

---

## Task 4: `SectionTitle` & `Card`

**Files:**
- Create: `src/components/ui/SectionTitle.tsx`
- Test: `src/components/ui/SectionTitle.test.tsx`
- Create: `src/components/ui/Card.tsx`
- Test: `src/components/ui/Card.test.tsx`

**Interfaces:**
- Consumes: `cn` (Task 2).
- Produces: `<SectionTitle title subtitle? centered? light? />`,
  `<Card variant? padding? hover? >{children}</Card>`. Story-/Info-/FAQ-Seiten
  (nächster Plan) nutzen beide für Überschriften bzw. Inhaltsboxen.

- [ ] **Step 1: Test für `SectionTitle` schreiben**

```tsx
// src/components/ui/SectionTitle.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SectionTitle from './SectionTitle'

describe('SectionTitle', () => {
  it('renders the title as a level-2 heading', () => {
    render(<SectionTitle title="Unsere Geschichte" />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Unsere Geschichte' })
    ).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<SectionTitle title="Titel" subtitle="Ein Untertitel" />)
    expect(screen.getByText('Ein Untertitel')).toBeInTheDocument()
  })

  it('renders without a subtitle when none is provided', () => {
    render(<SectionTitle title="Titel" />)
    expect(screen.queryByText('Ein Untertitel')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/ui/SectionTitle.test.tsx`
Expected: FAIL — `Cannot find module './SectionTitle'`

- [ ] **Step 3: `SectionTitle` implementieren**

```tsx
// src/components/ui/SectionTitle.tsx
import { cn } from '@/lib/utils'

interface SectionTitleProps {
  title: string
  subtitle?: string
  className?: string
  centered?: boolean
  light?: boolean
}

export default function SectionTitle({
  title,
  subtitle,
  className,
  centered = true,
  light = false,
}: SectionTitleProps) {
  return (
    <div className={cn('mb-10 md:mb-14', centered && 'text-center', className)}>
      <div className={cn('flex items-center gap-3 mb-4', centered && 'justify-center')}>
        <div className={cn('h-px w-8', light ? 'bg-white/30' : 'bg-gold/40')} />
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={cn(light ? 'text-white/60' : 'text-gold')}>
          <path d="M8 0L9.5 6.5L16 8L9.5 9.5L8 16L6.5 9.5L0 8L6.5 6.5L8 0Z" fill="currentColor" />
        </svg>
        <div className={cn('h-px w-8', light ? 'bg-white/30' : 'bg-gold/40')} />
      </div>

      <h2
        className={cn(
          'font-serif text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight',
          light ? 'text-white' : 'text-dark-blue'
        )}
      >
        {title}
      </h2>

      {subtitle && (
        <p
          className={cn(
            'mt-4 text-base md:text-lg leading-relaxed max-w-2xl',
            centered && 'mx-auto',
            light ? 'text-white/80' : 'text-gray-600'
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/ui/SectionTitle.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 5: Test für `Card` schreiben**

```tsx
// src/components/ui/Card.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from './Card'

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Inhalt der Karte</Card>)
    expect(screen.getByText('Inhalt der Karte')).toBeInTheDocument()
  })

  it('applies the dark variant background class', () => {
    render(<Card variant="dark">Dunkle Karte</Card>)
    expect(screen.getByText('Dunkle Karte').parentElement).toHaveClass('bg-dark-blue')
  })

  it('applies the default variant background class when no variant is given', () => {
    render(<Card>Standardkarte</Card>)
    expect(screen.getByText('Standardkarte').parentElement).toHaveClass('bg-white')
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/ui/Card.test.tsx`
Expected: FAIL — `Cannot find module './Card'`

- [ ] **Step 7: `Card` implementieren**

```tsx
// src/components/ui/Card.tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
  variant?: 'default' | 'champagne' | 'dark'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8 md:p-10',
}

const variantClasses = {
  default: 'bg-white border border-gray-100 shadow-sm',
  champagne: 'bg-champagne-light border border-champagne-dark/30',
  dark: 'bg-dark-blue text-white',
}

export default function Card({
  children,
  className,
  hover = false,
  padding = 'md',
  variant = 'default',
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        paddingClasses[padding],
        variantClasses[variant],
        hover && 'cursor-pointer transition-shadow hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/ui/Card.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 9: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 10: Commit**

```bash
git add src/components/ui/SectionTitle.tsx src/components/ui/SectionTitle.test.tsx \
  src/components/ui/Card.tsx src/components/ui/Card.test.tsx
git commit -m "Add SectionTitle and Card presentational components"
```

---

## Task 5: Navigation (vereinfacht)

**Files:**
- Create: `src/components/layout/Navigation.tsx`
- Test: `src/components/layout/Navigation.test.tsx`

**Interfaces:**
- Consumes: `navigationItems`, `couple` (Task 3), `cn` (Task 2).
- Produces: `<Navigation />` — in `layout.tsx` (Task 7 dieses Plans)
  eingebunden.

- [ ] **Step 1: Pakete installieren**

```bash
npm install framer-motion@14.1.0 lucide-react@1.55.0
```

- [ ] **Step 2: Ersten Test schreiben — alle Links werden angezeigt**

```tsx
// src/components/layout/Navigation.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Navigation from './Navigation'

let mockPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

describe('Navigation', () => {
  it('renders every navigation item as a link', () => {
    mockPathname = '/'
    render(<Navigation />)
    expect(screen.getAllByRole('link', { name: /Startseite/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Unsere Geschichte/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Hochzeitsinfos/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Galerie/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Quiz/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Gästespiel/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Erinnerungen/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Gästebuch/i }).length).toBeGreaterThan(0)
  })

  it('never renders a link to /admin', () => {
    mockPathname = '/'
    render(<Navigation />)
    const links = screen.getAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/admin')).toBe(false)
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/layout/Navigation.test.tsx`
Expected: FAIL — `Cannot find module './Navigation'`

- [ ] **Step 4: Minimale Implementierung (Desktop-Links, kein Mobile-Menü noch)**

```tsx
// src/components/layout/Navigation.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Heart } from 'lucide-react'
import { navigationItems } from '@/lib/site-content'
import { cn } from '@/lib/utils'

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-champagne' : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center gap-2" aria-label="Zur Startseite">
            <Heart size={18} className="text-gold fill-gold" />
            <span className="font-serif text-xl font-semibold tracking-wide text-dark-blue">S &amp; V</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                    isActive ? 'text-dark-blue font-semibold' : 'text-gray-600 hover:text-dark-blue'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
```

Hinweis für diesen Zwischenschritt: Für die ersten beiden Tests (alle
Links + kein `/admin`-Link) reicht die Desktop-Navigation allein noch
nicht als vollständige Implementierung — es gibt noch kein mobiles Menü,
das in Step 1 dieselben Links nochmal rendern würde (`getAllByRole` würde
sonst z. B. 1 statt potenziell 2 Treffer erwarten). Das ist in Ordnung: die
beiden Tests benutzen bewusst `getAllByRole(...).length).toBeGreaterThan(0)`
statt einer festen Anzahl, genau damit sie unabhängig davon bestehen, ob
später noch ein zweites (mobiles) Vorkommen hinzukommt.

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/layout/Navigation.test.tsx`
Expected: PASS (2/2)

- [ ] **Step 6: Test für aktiven Link + mobiles Menü schreiben**

```tsx
it('marks the current page as active', () => {
  mockPathname = '/story'
  render(<Navigation />)
  const storyLinks = screen.getAllByRole('link', { name: 'Unsere Geschichte' })
  expect(storyLinks[0]).toHaveClass('font-semibold')
})

it('opens the mobile menu on hamburger click and shows the links again', async () => {
  mockPathname = '/'
  render(<Navigation />)
  const toggle = screen.getByRole('button', { name: /Menü öffnen/i })
  await userEvent.click(toggle)
  expect(screen.getByRole('button', { name: /Menü schließen/i })).toBeInTheDocument()
  // Jetzt gibt es die Links doppelt: Desktop-Leiste (hidden via CSS, aber im DOM) + mobiles Menü.
  expect(screen.getAllByRole('link', { name: 'Gästebuch' }).length).toBeGreaterThanOrEqual(2)
})

it('closes the mobile menu when the route changes', () => {
  mockPathname = '/'
  const { rerender } = render(<Navigation />)
  // Menü öffnen, indem wir seinen internen State nicht direkt anfassen können -
  // stattdessen prüfen wir das Verhalten über den Pathname-Wechsel-Effekt:
  // nach einem Pathname-Wechsel muss der "Menü öffnen"-Button wieder da sein,
  // nicht "Menü schließen" (d.h. isOpen wurde zurückgesetzt).
  mockPathname = '/story'
  rerender(<Navigation />)
  expect(screen.getByRole('button', { name: /Menü öffnen/i })).toBeInTheDocument()
})
```

- [ ] **Step 7: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/layout/Navigation.test.tsx`
Expected: FAIL — `Unable to find role="button" name /Menü öffnen/` (es gibt
noch keinen Hamburger-Button)

- [ ] **Step 8: Mobiles Menü ergänzen**

```tsx
// src/components/layout/Navigation.tsx — ersetzt die vorherige Datei
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, Heart } from 'lucide-react'
import { couple, navigationItems } from '@/lib/site-content'
import { cn } from '@/lib/utils'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled || isOpen
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-champagne'
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/" className="flex items-center gap-2" aria-label="Zur Startseite">
              <Heart size={18} className="text-gold fill-gold" />
              <span className="font-serif text-xl font-semibold tracking-wide text-dark-blue">S &amp; V</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                      isActive ? 'text-dark-blue font-semibold' : 'text-gray-600 hover:text-dark-blue'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            <button
              onClick={() => setIsOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg text-dark-blue hover:bg-champagne/50 transition-colors"
              aria-label={isOpen ? 'Menü schließen' : 'Menü öffnen'}
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-40 bg-white lg:hidden"
          >
            <div className="flex flex-col h-full pt-20 pb-8 px-6">
              <div className="text-center mb-8">
                <p className="font-serif text-2xl text-dark-blue">{couple.combinedName}</p>
                <p className="text-sm text-gold mt-1">{couple.hashtag}</p>
              </div>
              <nav className="flex-1 overflow-y-auto">
                <ul className="space-y-1">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-200',
                            isActive
                              ? 'bg-dark-blue text-white'
                              : 'text-gray-700 hover:bg-champagne/50 hover:text-dark-blue'
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
```

- [ ] **Step 9: Tests erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/layout/Navigation.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 10: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/components/layout/Navigation.tsx \
  src/components/layout/Navigation.test.tsx
git commit -m "Add simplified Navigation without live visibility fetch or admin link"
```

---

## Task 6: Footer (vereinfacht)

**Files:**
- Create: `src/components/layout/Footer.tsx`
- Test: `src/components/layout/Footer.test.tsx`

**Interfaces:**
- Consumes: `navigationItems`, `couple` (Task 3).
- Produces: `<Footer />` — in `layout.tsx` (Task 7) eingebunden.

- [ ] **Step 1: Test schreiben**

```tsx
// src/components/layout/Footer.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from './Footer'

describe('Footer', () => {
  it('renders the combined couple name', () => {
    render(<Footer />)
    expect(screen.getByText('Saruga & Vinith')).toBeInTheDocument()
  })

  it('renders the reception date', () => {
    render(<Footer />)
    expect(screen.getByText(/17\. Oktober 2026/)).toBeInTheDocument()
  })

  it('renders every navigation item as a link', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'Unsere Geschichte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gästebuch' })).toBeInTheDocument()
  })

  it('never renders a link to /admin', () => {
    render(<Footer />)
    const links = screen.getAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/admin')).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/layout/Footer.test.tsx`
Expected: FAIL — `Cannot find module './Footer'`

- [ ] **Step 3: Implementierung**

```tsx
// src/components/layout/Footer.tsx
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { couple, navigationItems } from '@/lib/site-content'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-dark-blue text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              <Heart size={16} className="text-gold fill-gold" />
              <span className="font-serif text-2xl font-semibold text-white">
                {couple.combinedName}
              </span>
            </div>
            <p className="text-baby-blue text-sm leading-relaxed">
              Zwei Herzen, eine Liebe. Wir freuen uns, diesen besonderen
              Moment mit euch zu teilen.
            </p>
            <p className="mt-3 text-gold text-sm font-medium">{couple.hashtag}</p>
          </div>

          <div className="text-center">
            <h3 className="font-serif text-lg font-medium text-champagne mb-4">Navigation</h3>
            <nav>
              <ul className="space-y-2">
                {navigationItems.slice(0, 4).map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-gray-300 hover:text-white transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="text-center md:text-right">
            <h3 className="font-serif text-lg font-medium text-champagne mb-4">Weitere Seiten</h3>
            <nav>
              <ul className="space-y-2">
                {navigationItems.slice(4).map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-gray-300 hover:text-white transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
              <span>Empfang: 17. Oktober 2026</span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              Mit
              <Heart size={10} className="text-gold fill-gold inline" />
              gemacht &copy; {currentYear}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/layout/Footer.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Footer.tsx src/components/layout/Footer.test.tsx
git commit -m "Add simplified Footer without DB-driven visibility or admin link"
```

---

## Task 7: Navigation & Footer in `layout.tsx` einbinden

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `<Navigation />` (Task 5), `<Footer />` (Task 6).
- Produces: Jede Seite ist ab jetzt von Navigation (oben, fixiert) und
  Footer (unten) umgeben. Spätere Seiten-Pläne brauchen dafür nichts mehr
  zu tun.

- [ ] **Step 1: `layout.tsx` erweitern**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/layout/Navigation'
import Footer from '@/components/layout/Footer'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Saruga & Vinith',
  description: 'Alles rund um unsere Hochzeit am 17. Oktober 2026.',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="de" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-sans antialiased bg-white text-gray-900">
        <Navigation />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Bestehenden Home-Page-Test anpassen**

Der Test aus dem Grundgerüst-Plan (`src/app/page.test.tsx`) rendert
`<HomePage />` direkt, nicht über `layout.tsx` — er bleibt unverändert
gültig, weil `Navigation`/`Footer` nur in `layout.tsx` eingebunden sind,
nicht in `page.tsx` selbst.

Run: `npx vitest run src/app/page.test.tsx`
Expected: PASS (unverändert, 1/1)

- [ ] **Step 3: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün. Der Build rendert jetzt jede Seite mit
Navigation und Footer.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "Wire Navigation and Footer into the root layout"
```

---

## Abschluss

Nach Task 7 hat jede Seite der neuen App automatisch Navigation und Footer
im alten Look (Farben, Fonts, Grundanimationen), ohne die beiden
Sicherheits-/Architektur-Probleme der alten App (kein `/admin`-Link, keine
DB-Abfrage für Sichtbarkeit). `SectionTitle` und `Card` stehen als fertige
Bausteine für den nächsten Plan (Story/Info/FAQ) zur Verfügung.
