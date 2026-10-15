'use client'

import { useState, useSyncExternalStore } from 'react'
import SectionTitle from '@/components/ui/SectionTitle'
import WhoResults, { type TallyMap } from '@/components/sections/WhoResults'
import { usePolling } from '@/lib/use-polling'
import { takeResultsKey } from '@/lib/who-results-key'

const POLL_MS = 5000

interface Snapshot {
  released: boolean
  questions: TallyMap | null
}

const noSubscription = () => () => {}

function Notice({ title, children }: { title: string; children: string }) {
  return (
    <div className="card-ornate rounded-3xl p-8 text-center">
      <h3 className="font-display text-2xl font-semibold text-dark-blue mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{children}</p>
    </div>
  )
}

// Ergebnisse für den DJ: auch vor der Freigabe, alle paar Sekunden neu.
export default function WhoResultsPage() {
  // Der Schlüssel steht im Fragment des Links; auf dem Server gibt es ihn nicht.
  const key = useSyncExternalStore(noSubscription, takeResultsKey, () => null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [unreachable, setUnreachable] = useState(false)

  usePolling(
    () => {
      if (!key) return
      fetch('/api/who-votes', { cache: 'no-store', headers: { 'x-results-key': key } })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Laden fehlgeschlagen'))))
        .then((data: { released?: boolean; questions?: TallyMap | null }) => {
          setSnapshot({ released: data.released === true, questions: data.questions ?? null })
          setUnreachable(false)
        })
        .catch(() => setUnreachable(true))
    },
    { minDelayMs: POLL_MS, maxDelayMs: POLL_MS }
  )

  let content
  if (!key) {
    content = (
      <Notice title="Dieser Link ist unvollständig">
        Bitte den Link aus dem Admin-Bereich verwenden. Er enthält am Ende einen langen Schlüssel.
      </Notice>
    )
  } else if (snapshot && !snapshot.questions) {
    content = (
      <Notice title="Der Schlüssel gilt nicht">
        Bitte den Link im Admin-Bereich neu kopieren.
      </Notice>
    )
  } else if (snapshot?.questions) {
    content = (
      <>
        <p className="mb-5 text-center text-sm text-gray-600" role="status">
          {snapshot.released
            ? 'Für die Gäste freigegeben. Die Abstimmung ist beendet.'
            : 'Zwischenstand. Für die Gäste noch verborgen, es wird weiter abgestimmt.'}
          {unreachable && ' Keine Verbindung, der Stand ist nicht aktuell.'}
        </p>
        <WhoResults tally={snapshot.questions} />
      </>
    )
  } else {
    content = (
      <p className="text-center text-sm text-gray-500" role="status">
        {unreachable ? 'Keine Verbindung. Es wird weiter versucht.' : 'Wird geladen …'}
      </p>
    )
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle title="Wer von uns?" subtitle="Ergebnisse für den DJ" />
        {content}
      </div>
    </div>
  )
}
