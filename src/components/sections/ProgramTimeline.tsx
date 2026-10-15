'use client'

import { Cake, DoorOpen, Flower2, Music, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { ScheduleIcon, ScheduleItem } from '@/lib/event-info'
import { nextProgramIndex } from '@/lib/event-phase'
import { useNowSecond } from '@/lib/use-now-second'
import { cn } from '@/lib/utils'

interface ProgramTimelineProps {
  schedule: ScheduleItem[]
}

const ICONS: ReadonlyMap<ScheduleIcon, LucideIcon> = new Map([
  ['door', DoorOpen],
  ['cake', Cake],
  ['flower', Flower2],
  ['dinner', UtensilsCrossed],
  ['music', Music],
])

// Der Ablauf als Zeitleiste: ein Symbol im Kreis, daneben der Titel und darunter
// die Uhrzeit. Am Hochzeitstag zeigt "Als Nächstes" den nächsten Punkt mit
// bekannter Uhrzeit. Server und erster Browser-Render kennen die Uhrzeit nicht
// (null): dort steht keine Markierung, also gibt es keinen Hydration-Unterschied.
export default function ProgramTimeline({ schedule }: ProgramTimelineProps) {
  const nowSecond = useNowSecond()
  const next = nowSecond === null ? null : nextProgramIndex(nowSecond * 1000, schedule)

  return (
    <ol className="relative grid gap-7 pl-14 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-0.5 before:bg-gradient-to-b before:from-gold before:to-gold/20">
      {schedule.map((item, index) => {
        const hasTime = item.time !== 'TBA'
        const isNext = index === next
        const Icon = item.icon ? ICONS.get(item.icon) : undefined
        return (
          <li key={`${item.time}-${item.event}`} className="relative min-h-10">
            <span
              data-testid="program-marker"
              aria-hidden="true"
              className={cn(
                'absolute -left-14 top-0 flex h-10 w-10 items-center justify-center rounded-full border-2',
                isNext
                  ? 'border-bordeaux bg-bordeaux text-white shadow-[0_0_0_4px_rgba(122,36,50,0.18)]'
                  : 'border-gold bg-white text-gold-text'
              )}
            >
              {Icon ? <Icon size={18} /> : <span className="h-2 w-2 rounded-full bg-gold" />}
            </span>
            {isNext && (
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-bordeaux">Als Nächstes</p>
            )}
            <p className="font-display text-2xl font-semibold leading-tight text-dark-blue">{item.event}</p>
            {hasTime ? (
              <p className="mt-0.5 text-sm font-semibold text-gold-text">{item.time}</p>
            ) : (
              <p className="mt-0.5 text-sm italic text-gray-600">Uhrzeit folgt</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
