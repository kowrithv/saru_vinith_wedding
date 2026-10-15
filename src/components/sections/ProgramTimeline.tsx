'use client'

import type { ScheduleItem } from '@/lib/event-info'
import { nextProgramIndex } from '@/lib/event-phase'
import { useNowSecond } from '@/lib/use-now-second'
import { cn } from '@/lib/utils'

interface ProgramTimelineProps {
  schedule: ScheduleItem[]
}

// Der Ablauf als Zeitleiste: Titel, darunter die Uhrzeit. Am Hochzeitstag
// zeigt "Als Nächstes" den nächsten Punkt mit bekannter Uhrzeit. Server und erster Browser-Render
// kennen die Uhrzeit nicht (null): dort steht keine Markierung, also gibt es
// keinen Hydration-Unterschied.
export default function ProgramTimeline({ schedule }: ProgramTimelineProps) {
  const nowSecond = useNowSecond()
  const next = nowSecond === null ? null : nextProgramIndex(nowSecond * 1000, schedule)

  return (
    <ol className="relative grid gap-5 pl-8 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-0.5 before:bg-gradient-to-b before:from-gold before:to-gold/20">
      {schedule.map((item, index) => {
        const hasTime = item.time !== 'TBA'
        const isNext = index === next
        return (
          <li key={`${item.time}-${item.event}`} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                'absolute -left-8 top-1 h-5 w-5 rounded-full border-2',
                isNext ? 'border-bordeaux bg-bordeaux shadow-[0_0_0_4px_rgba(122,36,50,0.18)]' : 'border-gold bg-white'
              )}
            />
            {isNext && (
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-bordeaux">Als Nächstes</p>
            )}
            <p className="font-display text-xl font-semibold leading-snug text-dark-blue">{item.event}</p>
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
