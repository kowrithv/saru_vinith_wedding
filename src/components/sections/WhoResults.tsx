import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { couple } from '@/lib/site-content'
import WhoOptionBadge from '@/components/sections/WhoOptionBadge'
import { cn } from '@/lib/utils'

export type TallyMap = Record<string, Record<string, number>>

interface WhoResultsProps {
  tally: TallyMap
  /** Die eigenen Stimmen (Frage → Antwort); sie werden markiert. */
  myVotes?: Record<string, string>
}

function barColor(option: string): string {
  if (option === couple.bride) return 'bg-bordeaux'
  if (option === couple.groom) return 'bg-dark-blue'
  return 'bg-gold'
}

function votesLabel(total: number): string {
  return total === 1 ? '1 Stimme' : `${total} Stimmen`
}

// Alle Fragen mit ihrer Verteilung. Die vorn liegende Antwort ist fett (bei
// Gleichstand alle), die Balken sind nach dem Anteil an den Stimmen der Frage
// breit.
export default function WhoResults({ tally, myVotes = {} }: WhoResultsProps) {
  return (
    <div className="flex flex-col gap-5">
      {whoQuestions.map((question, index) => {
        const counts = tally[question.id] ?? {}
        const total = whoGameOptions.reduce((sum, option) => sum + (counts[option] ?? 0), 0)
        const top = Math.max(0, ...whoGameOptions.map((option) => counts[option] ?? 0))
        return (
          <section key={question.id} className="card-ornate rounded-3xl p-5 md:p-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Frage {index + 1}
            </p>
            <h3 className="font-display text-xl md:text-2xl font-semibold leading-tight text-dark-blue mb-4">
              {question.question}
            </h3>
            <ul className="flex flex-col gap-3">
              {whoGameOptions.map((option) => {
                const count = counts[option] ?? 0
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                const leading = total > 0 && count === top
                const mine = myVotes[question.id] === option
                return (
                  <li key={option} className="flex items-center gap-3">
                    <WhoOptionBadge option={option} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
                        <span className={cn('truncate', leading ? 'font-semibold text-dark-blue' : 'text-gray-600')}>
                          {option}
                          {mine && <span className="font-normal text-gray-500"> (deine Stimme)</span>}
                        </span>
                        <span className="flex-shrink-0 tabular-nums text-gray-600">
                          {count} · {percentage} %
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', barColor(option), leading ? '' : 'opacity-70')}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-gray-500">{votesLabel(total)}</p>
          </section>
        )
      })}
    </div>
  )
}
