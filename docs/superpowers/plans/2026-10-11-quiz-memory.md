# Quiz & Memory-Spiel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die `/quiz`-Seite (klassisches Wissens-Quiz + Live-Abstimmung „Wer
von uns?") und die `/memory-spiel`-Seite, mit den echten Inhalten der alten
Seite, auf dem Design-System aus dem vorherigen Plan.

**Architecture:** Das klassische Quiz und das Memory-Spiel sind rein
clientseitig (keine Server-Logik, Inhalte als TS-Konstanten). „Wer von uns?"
ist die einzige Komponente in diesem Plan mit Server-Zustand: eine
Live-Abstimmung über die bereits bestehende `who_votes`-Tabelle, mit
Dedup pro Gerät über eine lokal erzeugte, anonyme Geräte-ID (kein Login,
kein Name). Beide Quiz-Modi teilen sich eine Seite unter `/quiz` mit einem
Modus-Umschalter (wie in der alten App).

**Tech Stack:** Next.js App Router · React 19 · Tailwind v4 (Theme aus dem
Design-System-Plan) · framer-motion · better-sqlite3 (bereits vorhandenes
Schema) · Zod · lucide-react · Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-rewrite-design.md`

## Global Constraints

- Inhalte (Quiz-Fragen, „Wer von uns?"-Fragen, Memory-Bilder) sind 1:1 aus
  der alten Seite übernommen (als Text/Daten, nicht als Code).
- Die `who_votes`-Tabelle existiert bereits (Foundation-Plan,
  `src/lib/db.ts`) mit `UNIQUE(question_id, voter_id)`. Dieser Plan fügt
  nur die Zugriffsschicht + API-Routen hinzu, keine Schema-Änderung.
- **Kein Rate-Limiting auf den `who-votes`-Endpunkten.** Die Spec listet
  Rate-Limiting explizit nur für Login/Upload-Request/Gästebuch/
  Erinnerungen. Bei einer Live-Abstimmung mit ~400 Gästen wäre ein
  IP-basiertes Rate-Limit (mehrere Gäste können hinter derselben
  Router-IP sitzen) eher schädlich als nützlich — die
  `UNIQUE(question_id, voter_id)`-Constraint ist der eigentliche
  Schutz gegen Mehrfachstimmen.
- **Kein `revealAt`/Admin-Auflösung für „Wer von uns?"** (Spec: „Das Quiz
  zeigt Live-Ergebnisse, es gibt keine 'richtige Antwort', die aufgedeckt
  werden müsste"). Die alte App hatte dafür einen `WhoGameAdmin` und ein
  `correctAnswer`/`revealed`-Feld — beides entfällt ersatzlos.
- **Kein Namens-Gate für „Wer von uns?".** Das neue Schema
  (`who_votes (question_id, voter_id, option)`) hat bewusst keine
  Namensspalte — ohne Auflösung gibt es nichts, wofür ein Name gebraucht
  würde. Die alte „Wie heißt du?"-Eingangsmaske entfällt.
- **Kein `HeartBurst`/Konfetti-Effekt** wie in der alten App — rein
  kosmetisch, kein Kernfunktionsumfang, bei 4 Tagen Zeit bewusst
  gestrichen.
- **Keine Fallback-Icon-Karten im Memory-Spiel.** Es gibt zehn echte
  Fotos, gebraucht werden acht Paare — die alte App brauchte Icons nur
  als Lückenfüller für den Fall zu wenig echter Bilder; dieser Fall tritt
  hier nie ein.
- Memory-Spiel-Bilder: **≤ 100 KB pro Bild** (Spec). Die Originale liegen
  nur in der Git-Historie von `clean-start` (1,1–5,4 MB/Stück) und werden
  in Task 6 einmalig per Skript komprimiert und ins Repo committet. Das
  Skript nutzt `sharp`, das bereits transitiv über Next.js in
  `node_modules` liegt (`require.resolve('sharp')` löst direkt auf) —
  **keine neue eigene Abhängigkeit** in `package.json`.
- TDD ist Pflicht für jede Komponente/Funktion mit eigener Logik. Die
  Bild-Kompression (Task 6) ist ein einmaliger Build-Schritt ohne
  Anwendungslogik — dort tritt an die Stelle eines Tests eine geprüfte
  `Expected:`-Ausgabe (Dateigröße pro Bild).
- Jede der beiden Seiten (`/quiz`, `/memory-spiel`) trägt ihre eigene
  `pt-24 pb-16`-Außenhülle (Konvention aus dem Design-System-Plan).
- `/quiz` und `/memory-spiel` sind bereits in `navigationItems`
  (`src/lib/site-content.ts`) verlinkt — keine Navigations-Änderung in
  diesem Plan nötig.

## Review Focus

- Ein Gerät, das für eine Frage bereits abgestimmt hat, darf serverseitig
  **nie** ein zweites Mal gezählt werden — auch wenn `localStorage`
  gelöscht wurde und das Gerät es erneut versucht. Die
  `UNIQUE`-Constraint ist die Wahrheit, nicht nur der Client-Zustand.
- Das Live-Polling für „Wer von uns?" muss **vollständig pausieren**,
  solange der Browser-Tab nicht sichtbar ist, und sofort beim
  Sichtbarwerden wieder mit dem kürzesten Intervall starten — bei ~400
  Gästen ist ein unkontrolliertes Intervall ein echtes Server-Last-Risiko.
- Jedes Memory-Spiel-Bild muss nach der Kompression ≤ 100 KB sein — Gäste
  nutzen bei der Feier mobiles Netz.
- Ein Abstimmungs-Request mit unbekannter `questionId` oder unbekanntem
  `option`-Wert (manipulierter/fehlerhafter POST) darf nicht in der Tally
  landen, sondern muss vor dem Insert abgelehnt werden.
- Im klassischen Quiz darf ein Klick auf eine Antwort, nachdem die Frage
  bereits beantwortet ist (Doppelklick, später eintreffender Klick-Event),
  die Punktzahl nicht noch einmal verändern.

---

## Task 1: „Wer von uns?" — Datenzugriff & API-Routen

**Files:**
- Create: `src/lib/who-game-content.ts`
- Create: `src/lib/who-votes.ts`
- Test: `src/lib/who-votes.test.ts`
- Create: `src/app/api/who-votes/route.ts`
- Create: `src/app/api/who-votes/vote/route.ts`
- Test: `src/app/api/who-votes/route.test.ts`
- Test: `src/app/api/who-votes/vote/route.test.ts`

**Interfaces:**
- Consumes: `couple` (`src/lib/site-content.ts`), `getDb()`/`createDb()`
  (`src/lib/db.ts`).
- Produces: `interface WhoQuestion { id, question }`,
  `whoGameOptions: string[]`, `whoQuestions: WhoQuestion[]`,
  `castVote(db, questionId, voterId, option): { tally: Record<string, number>, alreadyVoted: boolean }`,
  `getTally(db): Record<string, Record<string, number>>`. Von Task 3
  (Komponente, über die API-Routen, nicht per direktem Import) und von
  diesem Task's eigenen Routen konsumiert.

- [ ] **Step 1: Inhalte anlegen**

```ts
// src/lib/who-game-content.ts
import { couple } from './site-content'

export interface WhoQuestion {
  id: string
  question: string
}

// Die Antwortmöglichkeiten sind für alle Fragen identisch.
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
```

- [ ] **Step 2: Test für die Zugriffsschicht schreiben**

```ts
// src/lib/who-votes.test.ts
import { describe, expect, it } from 'vitest'
import { createDb } from './db'
import { castVote, getTally } from './who-votes'
import { whoQuestions, whoGameOptions } from './who-game-content'

describe('getTally', () => {
  it('returns every question with every option at 0 before any vote', () => {
    const db = createDb(':memory:')
    const tally = getTally(db)

    expect(Object.keys(tally)).toHaveLength(whoQuestions.length)
    for (const question of whoQuestions) {
      for (const option of whoGameOptions) {
        expect(tally[question.id][option]).toBe(0)
      }
    }
    db.close()
  })

  it('reflects cast votes across questions and options', () => {
    const db = createDb(':memory:')
    castVote(db, '1', 'voter-a', whoGameOptions[0])
    castVote(db, '1', 'voter-b', whoGameOptions[0])
    castVote(db, '2', 'voter-a', whoGameOptions[1])

    const tally = getTally(db)
    expect(tally['1'][whoGameOptions[0]]).toBe(2)
    expect(tally['2'][whoGameOptions[1]]).toBe(1)
    expect(tally['2'][whoGameOptions[0]]).toBe(0)
    db.close()
  })
})

describe('castVote', () => {
  it('records a new vote and returns the updated tally for that question', () => {
    const db = createDb(':memory:')
    const result = castVote(db, '1', 'voter-a', whoGameOptions[0])

    expect(result.alreadyVoted).toBe(false)
    expect(result.tally[whoGameOptions[0]]).toBe(1)
    db.close()
  })

  it('never counts a second vote from the same voter on the same question', () => {
    const db = createDb(':memory:')
    castVote(db, '1', 'voter-a', whoGameOptions[0])
    const second = castVote(db, '1', 'voter-a', whoGameOptions[1])

    expect(second.alreadyVoted).toBe(true)
    // Die ursprüngliche Stimme bleibt unverändert, die zweite wird NICHT gezählt.
    expect(second.tally[whoGameOptions[0]]).toBe(1)
    expect(second.tally[whoGameOptions[1]]).toBe(0)

    const row = db
      .prepare('SELECT COUNT(*) as n FROM who_votes WHERE question_id = ? AND voter_id = ?')
      .get('1', 'voter-a') as { n: number }
    expect(row.n).toBe(1)
    db.close()
  })

  it('rejects an unknown question id', () => {
    const db = createDb(':memory:')
    expect(() => castVote(db, 'does-not-exist', 'voter-a', whoGameOptions[0])).toThrow()
    db.close()
  })

  it('rejects an unknown option value', () => {
    const db = createDb(':memory:')
    expect(() => castVote(db, '1', 'voter-a', 'Nicht-Existent')).toThrow()
    db.close()
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/who-votes.test.ts`
Expected: FAIL — `Cannot find module './who-votes'`

- [ ] **Step 4: Zugriffsschicht implementieren**

```ts
// src/lib/who-votes.ts
import type Database from 'better-sqlite3'
import { whoQuestions, whoGameOptions } from './who-game-content'

export interface VoteResult {
  tally: Record<string, number>
  alreadyVoted: boolean
}

function emptyTallyForQuestion(): Record<string, number> {
  return Object.fromEntries(whoGameOptions.map((option) => [option, 0]))
}

function tallyForQuestion(db: Database.Database, questionId: string): Record<string, number> {
  const tally = emptyTallyForQuestion()
  const rows = db
    .prepare('SELECT option, COUNT(*) as n FROM who_votes WHERE question_id = ? GROUP BY option')
    .all(questionId) as { option: string; n: number }[]
  for (const row of rows) {
    tally[row.option] = row.n
  }
  return tally
}

export function getTally(db: Database.Database): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {}
  for (const question of whoQuestions) {
    result[question.id] = tallyForQuestion(db, question.id)
  }
  return result
}

export function castVote(
  db: Database.Database,
  questionId: string,
  voterId: string,
  option: string
): VoteResult {
  if (!whoQuestions.some((q) => q.id === questionId)) {
    throw new Error('Unbekannte Frage.')
  }
  if (!whoGameOptions.includes(option)) {
    throw new Error('Unbekannte Antwort.')
  }

  try {
    db.prepare(
      'INSERT INTO who_votes (question_id, voter_id, option) VALUES (?, ?, ?)'
    ).run(questionId, voterId, option)
    return { tally: tallyForQuestion(db, questionId), alreadyVoted: false }
  } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Dieses Gerät hat für diese Frage schon abgestimmt (z. B. nach
      // gelöschtem localStorage erneut versucht) - die bestehende Stimme
      // bleibt gültig, es wird nur der aktuelle Stand zurückgegeben.
      return { tally: tallyForQuestion(db, questionId), alreadyVoted: true }
    }
    throw error
  }
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/who-votes.test.ts`
Expected: PASS (6/6)

- [ ] **Step 6: API-Routen-Tests schreiben**

```ts
// src/app/api/who-votes/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'

describe('GET /api/who-votes', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('returns a zero-initialized tally for every question before any vote', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(Object.keys(body.questions)).toHaveLength(whoQuestions.length)
    expect(body.questions['1'][whoGameOptions[0]]).toBe(0)
  })
})
```

```ts
// src/app/api/who-votes/vote/route.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from './route'
import { whoGameOptions } from '@/lib/who-game-content'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/who-votes/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/who-votes/vote', () => {
  const originalPath = process.env.DATABASE_PATH

  beforeEach(() => {
    delete globalThis.__appDb
    process.env.DATABASE_PATH = ':memory:'
  })

  afterEach(() => {
    globalThis.__appDb?.close()
    delete globalThis.__appDb
    process.env.DATABASE_PATH = originalPath
  })

  it('records a valid vote and returns the updated tally', async () => {
    const response = await POST(
      postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] })
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.tally[whoGameOptions[0]]).toBe(1)
    expect(body.alreadyVoted).toBe(false)
  })

  it('does not count a second vote from the same device on the same question', async () => {
    await POST(postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[0] }))
    const response = await POST(
      postRequest({ questionId: '1', voterId: 'voter-a', option: whoGameOptions[1] })
    )
    const body = await response.json()
    expect(body.alreadyVoted).toBe(true)
    expect(body.tally[whoGameOptions[0]]).toBe(1)
    expect(body.tally[whoGameOptions[1]]).toBe(0)
  })

  it('rejects an unknown question id with 400', async () => {
    const response = await POST(
      postRequest({ questionId: 'does-not-exist', voterId: 'voter-a', option: whoGameOptions[0] })
    )
    expect(response.status).toBe(400)
  })

  it('rejects a malformed body with 400', async () => {
    const response = await POST(postRequest({ questionId: '1' }))
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 7: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/who-votes/route.test.ts src/app/api/who-votes/vote/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (beide Dateien)

- [ ] **Step 8: API-Routen implementieren**

```ts
// src/app/api/who-votes/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getTally } from '@/lib/who-votes'

export async function GET(): Promise<Response> {
  const tally = getTally(getDb())
  return NextResponse.json({ questions: tally })
}
```

```ts
// src/app/api/who-votes/vote/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { castVote } from '@/lib/who-votes'

const voteSchema = z.object({
  questionId: z.string().min(1).max(50),
  voterId: z.string().min(1).max(100),
  option: z.string().min(1).max(50),
})

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = voteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  try {
    const result = castVote(getDb(), parsed.data.questionId, parsed.data.voterId, parsed.data.option)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Unbekannte Frage oder Antwort.' }, { status: 400 })
  }
}
```

- [ ] **Step 9: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/api/who-votes/route.test.ts src/app/api/who-votes/vote/route.test.ts`
Expected: PASS (1/1 und 4/4)

- [ ] **Step 10: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 11: Commit**

```bash
git add src/lib/who-game-content.ts src/lib/who-votes.ts src/lib/who-votes.test.ts \
  src/app/api/who-votes/route.ts src/app/api/who-votes/route.test.ts \
  src/app/api/who-votes/vote/route.ts src/app/api/who-votes/vote/route.test.ts
git commit -m "Add who-votes data access layer and API routes"
```

---

## Task 2: Geräte-ID & Polling-Hook

**Files:**
- Create: `src/lib/device-id.ts`
- Test: `src/lib/device-id.test.ts`
- Create: `src/lib/use-polling.ts`
- Test: `src/lib/use-polling.test.ts`

**Interfaces:**
- Produces: `getDeviceId(): string`,
  `usePolling(fetchFn: () => void, options?: { minDelayMs?, maxDelayMs?, backoffFactor? }): void`.
  Beide von Task 3 (`WhoKnowsUsGame`) konsumiert.

- [ ] **Step 1: Test für die Geräte-ID schreiben**

```ts
// src/lib/device-id.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDeviceId } from './device-id'

describe('getDeviceId', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('generates an id on first call and returns the same id on later calls', () => {
    const first = getDeviceId()
    const second = getDeviceId()
    expect(first).toBe(second)
    expect(first.length).toBeGreaterThan(0)
  })

  it('persists the id across independent calls (simulated reload)', () => {
    const first = getDeviceId()
    // Simuliert einen Reload: nur der Storage bleibt, kein In-Memory-Zustand.
    const second = getDeviceId()
    expect(second).toBe(first)
  })

  it('still returns a non-empty id when localStorage throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getDeviceId().length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/device-id.test.ts`
Expected: FAIL — `Cannot find module './device-id'`

- [ ] **Step 3: `getDeviceId` implementieren**

```ts
// src/lib/device-id.ts
const STORAGE_KEY = 'wedding-device-id'

export function getDeviceId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID()

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const generated = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, generated)
    return generated
  } catch {
    return crypto.randomUUID()
  }
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/device-id.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Test für den Polling-Hook schreiben**

```ts
// src/lib/use-polling.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { usePolling } from './use-polling'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

function Harness({ fetchFn }: { fetchFn: () => void }) {
  usePolling(fetchFn, { minDelayMs: 1000, maxDelayMs: 4000, backoffFactor: 2 })
  return null
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetchFn immediately on mount', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('backs off: second call after minDelayMs, third call after minDelayMs * factor', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(1999)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('stops polling while the tab is hidden', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    setHidden(true)
    vi.advanceTimersByTime(10000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('resumes immediately at the shortest interval when the tab becomes visible again', () => {
    const fetchFn = vi.fn()
    render(<Harness fetchFn={fetchFn} />)
    vi.advanceTimersByTime(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    setHidden(true)
    vi.advanceTimersByTime(10000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    setHidden(false)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('stops calling fetchFn after unmount', () => {
    const fetchFn = vi.fn()
    const { unmount } = render(<Harness fetchFn={fetchFn} />)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    unmount()
    vi.advanceTimersByTime(10000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/use-polling.test.ts`
Expected: FAIL — `Cannot find module './use-polling'`

- [ ] **Step 7: `usePolling` implementieren**

```ts
// src/lib/use-polling.ts
'use client'

import { useEffect, useRef } from 'react'

interface UsePollingOptions {
  minDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
}

export function usePolling(fetchFn: () => void, options: UsePollingOptions = {}): void {
  const { minDelayMs = 3000, maxDelayMs = 30000, backoffFactor = 1.5 } = options
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let delay = minDelayMs
    let stopped = false

    const tick = () => {
      if (stopped || document.hidden) {
        timeoutId = undefined
        return
      }
      fetchFnRef.current()
      timeoutId = setTimeout(tick, delay)
      delay = Math.min(delay * backoffFactor, maxDelayMs)
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && timeoutId === undefined && !stopped) {
        delay = minDelayMs
        tick()
      }
    }

    tick()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopped = true
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [minDelayMs, maxDelayMs, backoffFactor])
}
```

- [ ] **Step 8: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/lib/use-polling.test.ts`
Expected: PASS (5/5)

- [ ] **Step 9: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 10: Commit**

```bash
git add src/lib/device-id.ts src/lib/device-id.test.ts src/lib/use-polling.ts src/lib/use-polling.test.ts
git commit -m "Add device id and backoff polling hook"
```

---

## Task 3: „Wer von uns?" — Komponente

**Files:**
- Create: `src/components/sections/WhoKnowsUsGame.tsx`
- Test: `src/components/sections/WhoKnowsUsGame.test.tsx`

**Interfaces:**
- Consumes: `whoQuestions`, `whoGameOptions` (Task 1), `getDeviceId` (Task 2),
  `usePolling` (Task 2), `POST /api/who-votes/vote`, `GET /api/who-votes`
  (Task 1, über `fetch`).
- Produces: `<WhoKnowsUsGame />`. Von Task 5 (`/quiz`-Seite) konsumiert.

- [ ] **Step 1: Test schreiben**

```tsx
// src/components/sections/WhoKnowsUsGame.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhoKnowsUsGame from './WhoKnowsUsGame'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'

let capturedPoll: (() => void) | undefined

vi.mock('@/lib/use-polling', () => ({
  usePolling: (fn: () => void) => {
    capturedPoll = fn
  },
}))

vi.mock('@/lib/device-id', () => ({
  getDeviceId: () => 'test-device-id',
}))

function emptyTallyResponse() {
  return {
    questions: Object.fromEntries(
      whoQuestions.map((q) => [q.id, Object.fromEntries(whoGameOptions.map((o) => [o, 0]))])
    ),
  }
}

describe('WhoKnowsUsGame', () => {
  beforeEach(() => {
    capturedPoll = undefined
    window.localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => emptyTallyResponse() })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the first question with all three options', () => {
    render(<WhoKnowsUsGame />)
    expect(screen.getByText(whoQuestions[0].question)).toBeInTheDocument()
    whoGameOptions.forEach((option) => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    })
  })

  it('casts a vote and shows live results for that question', async () => {
    const voteResponse = {
      tally: Object.fromEntries(whoGameOptions.map((o, i) => [o, i === 0 ? 1 : 0])),
      alreadyVoted: false,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => voteResponse })
    )

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })

  it('disables voting again on a question that was already answered', async () => {
    const voteResponse = {
      tally: Object.fromEntries(whoGameOptions.map((o, i) => [o, i === 0 ? 1 : 0])),
      alreadyVoted: false,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => voteResponse })
    )

    render(<WhoKnowsUsGame />)
    await userEvent.click(screen.getByRole('button', { name: whoGameOptions[0] }))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: whoGameOptions[1] })).not.toBeInTheDocument()
  })

  it('advances to the next question and shows a finish screen after the last one', async () => {
    render(<WhoKnowsUsGame />)
    for (let i = 0; i < whoQuestions.length; i++) {
      await userEvent.click(screen.getByRole('button', { name: /weiter|fertig/i }))
    }
    expect(screen.getByText(/danke/i)).toBeInTheDocument()
  })

  it('updates the shown tally when a poll returns new data', async () => {
    render(<WhoKnowsUsGame />)
    const updated = {
      questions: {
        ...emptyTallyResponse().questions,
        [whoQuestions[0].id]: Object.fromEntries(
          whoGameOptions.map((o, i) => [o, i === 0 ? 5 : 0])
        ),
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => updated }))

    capturedPoll?.()
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/sections/WhoKnowsUsGame.test.tsx`
Expected: FAIL — `Cannot find module './WhoKnowsUsGame'`

- [ ] **Step 3: Komponente implementieren**

```tsx
// src/components/sections/WhoKnowsUsGame.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PartyPopper } from 'lucide-react'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { getDeviceId } from '@/lib/device-id'
import { usePolling } from '@/lib/use-polling'
import { cn } from '@/lib/utils'

const VOTES_STORAGE_KEY = 'who-game-votes'

type TallyMap = Record<string, Record<string, number>>

function emptyTally(): TallyMap {
  return Object.fromEntries(
    whoQuestions.map((q) => [q.id, Object.fromEntries(whoGameOptions.map((o) => [o, 0]))])
  )
}

function loadLocalVotes(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(VOTES_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalVote(questionId: string, option: string) {
  try {
    const votes = loadLocalVotes()
    votes[questionId] = option
    window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes))
  } catch {
    // localStorage kann in seltenen Fällen fehlschlagen - die Stimme ist serverseitig trotzdem gezählt.
  }
}

export default function WhoKnowsUsGame() {
  const [tally, setTally] = useState<TallyMap>(emptyTally)
  const [myVotes, setMyVotes] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    setMyVotes(loadLocalVotes())
  }, [])

  usePolling(() => {
    fetch('/api/who-votes', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { questions: TallyMap } | null) => {
        if (data) setTally(data.questions)
      })
      .catch(() => {})
  })

  const currentQuestion = whoQuestions[currentIndex]
  const myVote = myVotes[currentQuestion?.id ?? '']
  const hasVoted = Boolean(myVote)
  const isLastQuestion = currentIndex === whoQuestions.length - 1
  const currentTally = tally[currentQuestion?.id ?? ''] ?? Object.fromEntries(whoGameOptions.map((o) => [o, 0]))
  const totalVotes = Object.values(currentTally).reduce((sum, n) => sum + n, 0)

  const handleVote = async (option: string) => {
    if (hasVoted || !currentQuestion) return

    saveLocalVote(currentQuestion.id, option)
    setMyVotes((prev) => ({ ...prev, [currentQuestion.id]: option }))

    try {
      const response = await fetch('/api/who-votes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, voterId: getDeviceId(), option }),
      })
      if (response.ok) {
        const data = (await response.json()) as { tally: Record<string, number> }
        setTally((prev) => ({ ...prev, [currentQuestion.id]: data.tally }))
      }
    } catch {
      // Stimme bleibt lokal gespeichert, auch wenn der Server gerade nicht erreichbar ist.
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      setFinished(true)
      return
    }
    setCurrentIndex((i) => i + 1)
  }

  if (finished) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12"
      >
        <PartyPopper size={36} className="text-gold mx-auto mb-4" />
        <h3 className="font-serif text-xl font-semibold text-dark-blue mb-2">Danke fürs Mitmachen!</h3>
        <p className="text-gray-500 text-sm">
          Die Ergebnisse gibt es live bei der Feier zu sehen.
        </p>
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8"
      >
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Frage {currentIndex + 1} von {whoQuestions.length}
        </p>
        <h3 className="font-serif text-lg md:text-xl font-semibold text-dark-blue mb-6">
          {currentQuestion.question}
        </h3>

        {!hasVoted ? (
          <div className="flex flex-col gap-3">
            {whoGameOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleVote(option)}
                className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-dark-blue hover:bg-champagne/30 transition-colors text-left"
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {whoGameOptions.map((option) => {
              const count = currentTally[option] ?? 0
              const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
              return (
                <div key={option}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span
                      className={cn(
                        'font-medium',
                        option === myVote ? 'text-dark-blue' : 'text-gray-600'
                      )}
                    >
                      {option}
                      {option === myVote && ' (deine Stimme)'}
                    </span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleNext}
          className="mt-6 w-full px-5 py-3 rounded-xl bg-dark-blue text-white text-sm font-medium hover:bg-dark-blue-light transition-colors"
        >
          {isLastQuestion ? 'Fertig' : 'Weiter'}
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/sections/WhoKnowsUsGame.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/WhoKnowsUsGame.tsx src/components/sections/WhoKnowsUsGame.test.tsx
git commit -m "Add Wer-von-uns live voting component"
```

---

## Task 4: Button-Komponente & Klassisches Quiz

**Files:**
- Create: `src/components/ui/Button.tsx`
- Test: `src/components/ui/Button.test.tsx`
- Create: `src/lib/quiz-content.ts`
- Create: `src/components/sections/ClassicQuiz.tsx`
- Test: `src/components/sections/ClassicQuiz.test.tsx`

**Interfaces:**
- Produces: `<Button variant size disabled onClick>` (von `ClassicQuiz` und
  Task 7 `MemoryGame` konsumiert), `quizQuestions: QuizQuestion[]`,
  `interface QuizQuestion { id, question, options, correctIndex }`,
  `<ClassicQuiz />` (von Task 5 `/quiz`-Seite konsumiert).

- [ ] **Step 1: Test für `Button` schreiben**

```tsx
// src/components/ui/Button.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button', () => {
  it('renders its children and responds to clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Weiter</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Weiter
      </Button>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: FAIL — `Cannot find module './Button'`

- [ ] **Step 3: `Button` implementieren**

```tsx
// src/components/ui/Button.tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const variantClasses = {
  primary: 'bg-dark-blue text-white hover:bg-dark-blue-light shadow-md hover:shadow-lg',
  secondary: 'border-2 border-dark-blue text-dark-blue hover:bg-dark-blue hover:text-white',
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: PASS (2/2)

- [ ] **Step 5: Quiz-Inhalte anlegen**

```ts
// src/lib/quiz-content.ts
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
```

- [ ] **Step 6: Test für `ClassicQuiz` schreiben**

```tsx
// src/components/sections/ClassicQuiz.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClassicQuiz from './ClassicQuiz'
import { quizQuestions } from '@/lib/quiz-content'

async function answerCurrentQuestion(index: number, chooseCorrect: boolean) {
  const question = quizQuestions[index]
  const optionIndex = chooseCorrect
    ? question.correctIndex
    : (question.correctIndex + 1) % question.options.length
  await userEvent.click(screen.getByRole('button', { name: question.options[optionIndex] }))
}

describe('ClassicQuiz', () => {
  it('renders the first question with all its options', () => {
    render(<ClassicQuiz />)
    expect(screen.getByText(quizQuestions[0].question)).toBeInTheDocument()
    quizQuestions[0].options.forEach((option) => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    })
  })

  it('ignores a second click on a different option once the question is answered', async () => {
    render(<ClassicQuiz />)
    await answerCurrentQuestion(0, true)
    const wrongOption = quizQuestions[0].options[(quizQuestions[0].correctIndex + 1) % 4]
    await userEvent.click(screen.getByRole('button', { name: wrongOption }))

    await userEvent.click(screen.getByRole('button', { name: /weiter/i }))
    for (let i = 1; i < quizQuestions.length; i++) {
      await answerCurrentQuestion(i, false)
      await userEvent.click(screen.getByRole('button', { name: /weiter|ergebnis/i }))
    }
    // Score wäre 2 statt 1, wenn der zweite (ignorierte) Klick gezählt hätte.
    expect(screen.getByText(/^1 von 8$/)).toBeInTheDocument()
  })

  it('advances through all questions and shows the final score', async () => {
    render(<ClassicQuiz />)
    for (let i = 0; i < quizQuestions.length; i++) {
      await answerCurrentQuestion(i, true)
      await userEvent.click(screen.getByRole('button', { name: /weiter|ergebnis/i }))
    }
    expect(screen.getByText(`${quizQuestions.length} von ${quizQuestions.length}`)).toBeInTheDocument()
  })

  it('restarts from the first question', async () => {
    render(<ClassicQuiz />)
    for (let i = 0; i < quizQuestions.length; i++) {
      await answerCurrentQuestion(i, true)
      await userEvent.click(screen.getByRole('button', { name: /weiter|ergebnis/i }))
    }
    await userEvent.click(screen.getByRole('button', { name: /nochmal/i }))
    expect(screen.getByText(quizQuestions[0].question)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/sections/ClassicQuiz.test.tsx`
Expected: FAIL — `Cannot find module './ClassicQuiz'`

- [ ] **Step 8: `ClassicQuiz` implementieren**

```tsx
// src/components/sections/ClassicQuiz.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'
import Button from '@/components/ui/Button'
import { quizQuestions } from '@/lib/quiz-content'
import { cn } from '@/lib/utils'

function getResultMessage(score: number, total: number): { title: string; message: string } {
  const percentage = (score / total) * 100
  if (percentage === 100) {
    return {
      title: 'Perfekt!',
      message: 'Ihr kennt uns in- und auswendig! Wir freuen uns, euch bei unserer Hochzeit dabei zu haben!',
    }
  } else if (percentage >= 75) {
    return {
      title: 'Sehr gut!',
      message: 'Ihr kennt uns wirklich gut! Wir freuen uns auf euch!',
    }
  } else if (percentage >= 50) {
    return {
      title: 'Gut gemacht!',
      message: 'Mehr als die Hälfte richtig! Lest noch einmal unsere Geschichte und versucht es erneut.',
    }
  }
  return {
    title: 'Noch Luft nach oben!',
    message: 'Lest unsere Geschichte auf der Webseite und versucht es nochmal. Wir freuen uns trotzdem auf euch!',
  }
}

export default function ClassicQuiz() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)

  const currentQuestion = quizQuestions[currentIndex]
  const isAnswered = selectedOption !== null
  const isLastQuestion = currentIndex === quizQuestions.length - 1

  const handleSelectOption = (optionIndex: number) => {
    if (isAnswered) return
    setSelectedOption(optionIndex)
    if (optionIndex === currentQuestion.correctIndex) {
      setScore((prev) => prev + 1)
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResult(true)
      return
    }
    setCurrentIndex((prev) => prev + 1)
    setSelectedOption(null)
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setSelectedOption(null)
    setScore(0)
    setShowResult(false)
  }

  const getOptionStyle = (optionIndex: number) => {
    if (!isAnswered) {
      return 'border-gray-200 bg-white text-gray-700 hover:border-dark-blue hover:bg-champagne/30'
    }
    if (optionIndex === currentQuestion.correctIndex) {
      return 'border-green-400 bg-green-50 text-green-800'
    }
    if (optionIndex === selectedOption) {
      return 'border-red-400 bg-red-50 text-red-800'
    }
    return 'border-gray-100 bg-gray-50 text-gray-400 opacity-60'
  }

  if (showResult) {
    const result = getResultMessage(score, quizQuestions.length)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12"
      >
        <Trophy size={36} className="text-gold mx-auto mb-4" />
        <p className="font-serif text-3xl font-bold text-dark-blue mb-1">
          {score} von {quizQuestions.length}
        </p>
        <h3 className="font-serif text-xl font-semibold text-dark-blue mb-3">{result.title}</h3>
        <p className="text-gray-500 text-sm mb-6">{result.message}</p>
        <Button onClick={handleRestart}>Nochmal versuchen</Button>
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8"
      >
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Frage {currentIndex + 1} von {quizQuestions.length}
        </p>
        <h3 className="font-serif text-lg md:text-xl font-semibold text-dark-blue mb-6">
          {currentQuestion.question}
        </h3>

        <div className="flex flex-col gap-3 mb-6">
          {currentQuestion.options.map((option, optionIndex) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelectOption(optionIndex)}
              className={cn(
                'px-5 py-3 rounded-xl border text-sm font-medium text-left transition-colors',
                getOptionStyle(optionIndex)
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <Button onClick={handleNext} disabled={!isAnswered} className="w-full">
          {isLastQuestion ? 'Ergebnis anzeigen' : 'Weiter'}
        </Button>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 9: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/sections/ClassicQuiz.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 10: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Button.test.tsx \
  src/lib/quiz-content.ts src/components/sections/ClassicQuiz.tsx src/components/sections/ClassicQuiz.test.tsx
git commit -m "Add Button component and classic trivia quiz"
```

---

## Task 5: Quiz-Seite mit Modus-Umschalter

**Files:**
- Create: `src/app/quiz/page.tsx`
- Test: `src/app/quiz/page.test.tsx`

**Interfaces:**
- Consumes: `<ClassicQuiz />` (Task 4), `<WhoKnowsUsGame />` (Task 3).

- [ ] **Step 1: Test schreiben**

```tsx
// src/app/quiz/page.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizPage from './page'

vi.mock('@/components/sections/ClassicQuiz', () => ({
  default: () => <div data-testid="classic-quiz-stub" />,
}))
vi.mock('@/components/sections/WhoKnowsUsGame', () => ({
  default: () => <div data-testid="who-game-stub" />,
}))

describe('QuizPage', () => {
  it('shows the classic quiz by default', () => {
    render(<QuizPage />)
    expect(screen.getByTestId('classic-quiz-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('who-game-stub')).not.toBeInTheDocument()
  })

  it('switches to Wer von uns when that mode is selected', async () => {
    render(<QuizPage />)
    await userEvent.click(screen.getByRole('button', { name: /wer von uns/i }))
    expect(screen.getByTestId('who-game-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('classic-quiz-stub')).not.toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<QuizPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/quiz/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Seite implementieren**

```tsx
// src/app/quiz/page.tsx
'use client'

import { useState } from 'react'
import { Trophy, Users2 } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import ClassicQuiz from '@/components/sections/ClassicQuiz'
import WhoKnowsUsGame from '@/components/sections/WhoKnowsUsGame'
import { cn } from '@/lib/utils'

type Mode = 'classic' | 'who'

export default function QuizPage() {
  const [mode, setMode] = useState<Mode>('classic')

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Hochzeits-Quiz"
          subtitle={
            mode === 'classic'
              ? 'Wie gut kennt ihr uns? Testet euer Wissen in 8 Fragen!'
              : 'Stimmt ab, wer von uns beiden eher zutrifft!'
          }
        />

        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
            <button
              type="button"
              onClick={() => setMode('classic')}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                mode === 'classic' ? 'bg-dark-blue text-white shadow-sm' : 'text-gray-600 hover:text-dark-blue'
              )}
            >
              <Trophy size={15} />
              Klassisches Quiz
            </button>
            <button
              type="button"
              onClick={() => setMode('who')}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                mode === 'who' ? 'bg-dark-blue text-white shadow-sm' : 'text-gray-600 hover:text-dark-blue'
              )}
            >
              <Users2 size={15} />
              Wer von uns?
            </button>
          </div>
        </div>

        {mode === 'classic' ? <ClassicQuiz /> : <WhoKnowsUsGame />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/quiz/page.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 5: Gesamte Toolchain prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alle grün

- [ ] **Step 6: Commit**

```bash
git add src/app/quiz/page.tsx src/app/quiz/page.test.tsx
git commit -m "Add quiz page with classic/wer-von-uns mode switcher"
```

---

## Task 6: Memory-Spiel-Bilder komprimieren

**Files:**
- Create: `scripts/compress-memory-images.mjs`
- Create: `public/memory-spiel/memory-1.jpg` … `memory-10.jpg`

**Interfaces:**
- Produces: zehn JPEGs unter `public/memory-spiel/`, je ≤ 100 KB. Von
  Task 7 (`src/lib/memory-content.ts`) referenziert.

Dies ist ein einmaliger Build-Schritt ohne Anwendungslogik — kein TDD,
stattdessen eine geprüfte `Expected:`-Ausgabe pro Schritt.

- [ ] **Step 1: Originale aus der Git-Historie holen**

```bash
mkdir -p /tmp/memory-originals
for i in 1 2 3 4 5 6 7 8 9 10; do
  git show clean-start:public/memory-spiel/memory-$i.jpg > /tmp/memory-originals/memory-$i.jpg
done
ls -la /tmp/memory-originals/
```

Expected: 10 Dateien, je zwischen ~1,1 MB und ~5,4 MB.

- [ ] **Step 2: Kompressions-Skript schreiben**

```js
// scripts/compress-memory-images.mjs
import sharp from 'sharp'
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_DIR = process.argv[2] ?? '/tmp/memory-originals'
const TARGET_DIR = path.join(process.cwd(), 'public', 'memory-spiel')
const MAX_DIMENSION = 800
const MAX_BYTES = 100 * 1024

async function compressOne(file) {
  const sourcePath = path.join(SOURCE_DIR, file)
  const targetPath = path.join(TARGET_DIR, file)

  let quality = 80
  let buffer = await sharp(sourcePath)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .rotate()
    .jpeg({ quality })
    .toBuffer()

  while (buffer.length > MAX_BYTES && quality > 30) {
    quality -= 10
    buffer = await sharp(sourcePath)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .rotate()
      .jpeg({ quality })
      .toBuffer()
  }

  await writeFile(targetPath, buffer)
  console.log(`${file}: ${buffer.length} bytes (quality ${quality})`)
}

async function main() {
  await mkdir(TARGET_DIR, { recursive: true })
  const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('.jpg'))
  for (const file of files) {
    await compressOne(file)
  }
}

main()
```

- [ ] **Step 3: Skript laufen lassen**

Run: `node scripts/compress-memory-images.mjs /tmp/memory-originals`
Expected: zehn Zeilen `memory-N.jpg: <bytes> bytes (quality <q>)`, jede mit
`<bytes>` unter 102400.

- [ ] **Step 4: Dateigrößen verifizieren**

Run: `ls -la public/memory-spiel/ | awk '{print $5, $9}'`
Expected: alle zehn `memory-N.jpg`-Dateien zwischen ca. 15 KB und 100 KB.

- [ ] **Step 5: Visuell stichprobenhaft prüfen**

Öffne `public/memory-spiel/memory-1.jpg` und `memory-8.jpg` (das größte
Original) im Bild-Tool und bestätige: Hochformat-Fotos sind nicht
verdreht (dank `.rotate()` nach EXIF-Orientierung), Bildqualität ist für
eine kleine Memory-Karte ausreichend scharf.

- [ ] **Step 6: Commit**

```bash
git add scripts/compress-memory-images.mjs public/memory-spiel/
git commit -m "Add compressed memory-game images and the script that produced them"
```

---

## Task 7: Memory-Spiel — Komponente & Seite

**Files:**
- Create: `src/lib/memory-content.ts`
- Create: `src/components/sections/MemoryGame.tsx`
- Test: `src/components/sections/MemoryGame.test.tsx`
- Create: `src/app/memory-spiel/page.tsx`
- Test: `src/app/memory-spiel/page.test.tsx`

**Interfaces:**
- Consumes: `<Button />` (Task 4), Bilder aus Task 6.
- Produces: `memoryImages: string[]`, `<MemoryGame />`.

- [ ] **Step 1: Inhalte anlegen**

```ts
// src/lib/memory-content.ts
export const memoryImages: string[] = [
  '/memory-spiel/memory-1.jpg',
  '/memory-spiel/memory-2.jpg',
  '/memory-spiel/memory-3.jpg',
  '/memory-spiel/memory-4.jpg',
  '/memory-spiel/memory-5.jpg',
  '/memory-spiel/memory-6.jpg',
  '/memory-spiel/memory-7.jpg',
  '/memory-spiel/memory-8.jpg',
  '/memory-spiel/memory-9.jpg',
  '/memory-spiel/memory-10.jpg',
]

export const MEMORY_PAIRS_COUNT = 8
```

- [ ] **Step 2: Test für `MemoryGame` schreiben**

```tsx
// src/components/sections/MemoryGame.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemoryGame from './MemoryGame'
import { MEMORY_PAIRS_COUNT } from '@/lib/memory-content'

describe('MemoryGame', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('deals a board with twice as many cards as there are pairs', () => {
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    expect(cards).toHaveLength(MEMORY_PAIRS_COUNT * 2)
  })

  it('flips the two clicked cards face up', async () => {
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    await userEvent.click(cards[0])
    expect(cards[0]).toBeDisabled()
  })

  it('locks further clicks while two cards are already flipped', async () => {
    render(<MemoryGame />)
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    await userEvent.click(cards[0])
    await userEvent.click(cards[1])
    const thirdBefore = cards[2]
    await userEvent.click(thirdBefore)
    // Während zwei Karten aufgedeckt sind (und noch nicht wieder zu/match
    // sind), darf eine dritte Karte nicht sofort umdrehbar sein.
    expect(thirdBefore).not.toBeDisabled()
  })

  it('increments the move counter once per pair of flips', async () => {
    render(<MemoryGame />)
    expect(screen.getByText(/0 Züge/)).toBeInTheDocument()
    const cards = screen.getAllByRole('button', { name: 'Karte umdrehen' })
    await userEvent.click(cards[0])
    await userEvent.click(cards[1])
    expect(screen.getByText(/1 Züge/)).toBeInTheDocument()
  })

  it('starts a fresh board on "Neues Spiel"', async () => {
    render(<MemoryGame />)
    await userEvent.click(screen.getByRole('button', { name: /neues spiel/i }))
    expect(screen.getByText(/0 Züge/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/components/sections/MemoryGame.test.tsx`
Expected: FAIL — `Cannot find module './MemoryGame'`

- [ ] **Step 4: `MemoryGame` implementieren**

```tsx
// src/components/sections/MemoryGame.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Timer, MousePointerClick, Trophy } from 'lucide-react'
import Button from '@/components/ui/Button'
import { memoryImages, MEMORY_PAIRS_COUNT } from '@/lib/memory-content'

const STORAGE_KEY = 'memory-spiel-best'

interface MemoryCard {
  id: string
  faceIndex: number
  isMatched: boolean
}

interface BestScore {
  moves: number
  seconds: number
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickFaces(): string[] {
  return shuffle(memoryImages).slice(0, MEMORY_PAIRS_COUNT)
}

function createShuffledDeck(faces: string[]): MemoryCard[] {
  const pairs = faces.flatMap((_, faceIndex) => [
    { id: crypto.randomUUID(), faceIndex, isMatched: false },
    { id: crypto.randomUUID(), faceIndex, isMatched: false },
  ])
  return shuffle(pairs)
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function MemoryGame() {
  const [faces, setFaces] = useState<string[]>([])
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [flippedIds, setFlippedIds] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isWon, setIsWon] = useState(false)
  const [bestScore, setBestScore] = useState<BestScore | null>(null)

  const startNewGame = () => {
    const newFaces = pickFaces()
    setFaces(newFaces)
    setCards(createShuffledDeck(newFaces))
    setFlippedIds([])
    setLocked(false)
    setMoves(0)
    setSeconds(0)
    setIsRunning(true)
    setIsWon(false)
  }

  useEffect(() => {
    startNewGame()
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setBestScore(JSON.parse(raw))
    } catch {
      // ignore corrupt localStorage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    if (flippedIds.length !== 2) return
    setLocked(true)
    setMoves((m) => m + 1)

    const [firstId, secondId] = flippedIds
    const first = cards.find((c) => c.id === firstId)
    const second = cards.find((c) => c.id === secondId)
    const isMatch = first && second && first.faceIndex === second.faceIndex

    const timeout = setTimeout(() => {
      if (isMatch) {
        setCards((prev) =>
          prev.map((c) => (c.id === firstId || c.id === secondId ? { ...c, isMatched: true } : c))
        )
      }
      setFlippedIds([])
      setLocked(false)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, isMatch ? 500 : 900)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flippedIds])

  useEffect(() => {
    if (cards.length === 0) return
    const allMatched = cards.every((c) => c.isMatched)
    if (!allMatched || isWon) return

    setIsWon(true)
    setIsRunning(false)

    setBestScore((prev) => {
      const candidate: BestScore = { moves, seconds }
      const isBetter = !prev || candidate.moves < prev.moves || (candidate.moves === prev.moves && candidate.seconds < prev.seconds)
      const next = isBetter ? candidate : prev
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore write errors (e.g. private browsing)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])

  const isCardVisible = (card: MemoryCard) => card.isMatched || flippedIds.includes(card.id)

  const handleCardClick = (card: MemoryCard) => {
    if (locked || card.isMatched || flippedIds.includes(card.id) || flippedIds.length === 2) return
    setFlippedIds((prev) => [...prev, card.id])
  }

  const gridCards = useMemo(() => cards, [cards])

  return (
    <div>
      <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6 text-sm">
        <div className="flex items-center gap-2 text-dark-blue font-medium">
          <MousePointerClick size={16} className="text-gold" />
          {moves} Züge
        </div>
        <div className="flex items-center gap-2 text-dark-blue font-medium">
          <Timer size={16} className="text-gold" />
          {formatTime(seconds)}
        </div>
        {bestScore && (
          <div className="flex items-center gap-2 text-gray-400">
            <Trophy size={16} className="text-gold" />
            Bestzeit: {bestScore.moves} Züge · {formatTime(bestScore.seconds)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {gridCards.map((card) => {
          const face = faces[card.faceIndex]
          const visible = isCardVisible(card)
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(card)}
              disabled={visible}
              className="aspect-square [perspective:600px]"
              aria-label="Karte umdrehen"
            >
              <motion.div
                className="relative w-full h-full [transform-style:preserve-3d]"
                animate={{ rotateY: visible ? 180 : 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="absolute inset-0 rounded-xl bg-dark-blue flex items-center justify-center [backface-visibility:hidden] shadow-sm">
                  <Heart size={18} className="text-white/30" />
                </div>
                <div
                  className={`absolute inset-0 rounded-xl overflow-hidden flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)] border-2 ${
                    card.isMatched ? 'border-green-400' : 'border-champagne-dark/30'
                  }`}
                >
                  {face && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={face} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              </motion.div>
            </button>
          )
        })}
      </div>

      {isWon && (
        <div className="text-center mt-8">
          <p className="font-serif text-xl font-semibold text-dark-blue mb-4">Geschafft! 🎉</p>
          <Button onClick={startNewGame}>Neues Spiel</Button>
        </div>
      )}
      {!isWon && (
        <div className="text-center mt-8">
          <Button variant="secondary" onClick={startNewGame}>
            Neues Spiel
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/components/sections/MemoryGame.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 6: Test für die Seite schreiben**

```tsx
// src/app/memory-spiel/page.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MemorySpielPage from './page'

vi.mock('@/components/sections/MemoryGame', () => ({
  default: () => <div data-testid="memory-game-stub" />,
}))

describe('MemorySpielPage', () => {
  it('renders the memory game', () => {
    render(<MemorySpielPage />)
    expect(screen.getByTestId('memory-game-stub')).toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<MemorySpielPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
```

- [ ] **Step 7: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/memory-spiel/page.test.tsx`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 8: Seite implementieren**

```tsx
// src/app/memory-spiel/page.tsx
import SectionTitle from '@/components/ui/SectionTitle'
import MemoryGame from '@/components/sections/MemoryGame'

export default function MemorySpielPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Gästespiel: Liebes-Memory"
          subtitle="Findet alle Pärchen! Deckt zwei Karten auf – passen die Fotos zusammen, bleiben sie offen."
        />
        <MemoryGame />
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Test erneut laufen lassen, grün bestätigen**

Run: `npx vitest run src/app/memory-spiel/page.test.tsx`
Expected: PASS (2/2)

- [ ] **Step 10: Gesamte Toolchain inklusive Build prüfen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: alle vier grün.

- [ ] **Step 11: Commit**

```bash
git add src/lib/memory-content.ts src/components/sections/MemoryGame.tsx \
  src/components/sections/MemoryGame.test.tsx src/app/memory-spiel/page.tsx \
  src/app/memory-spiel/page.test.tsx
git commit -m "Add memory game component and page"
```

---

## Abschluss

Nach Task 7 sind Quiz (beide Modi) und Memory-Spiel live, erreichbar über
die bereits bestehende Navigation. „Wer von uns?" ist die erste Komponente
in diesem Umbau mit echtem Server-Zustand (`who_votes`) und muss daher vor
dem Freeze auch unter Last getestet werden (Spec: Lasttest-Skripte unter
`scripts/load/*.mjs`) — das ist nicht Teil dieses Plans.
