'use client'

import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import WhoResults, { type TallyMap } from '@/components/sections/WhoResults'
import { textFieldClassName } from '@/lib/form-styles'
import { clearResultsKey, rememberResultsKey, subscribeResultsKey, takeResultsKey } from '@/lib/who-results-key'

const POLL_MS = 5000

interface Snapshot {
  released: boolean
  questions: TallyMap | null
}

function CodeForm({ notice }: { notice: string | null }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!rememberResultsKey(input)) {
      setError('Bitte das Wort eintippen, nur Buchstaben.')
    }
  }

  const message = error ?? notice
  return (
    <form onSubmit={handleSubmit} className="card-ornate rounded-3xl p-6 md:p-8">
      <h3 className="font-display text-2xl font-semibold text-dark-blue mb-2 text-center">Wort eingeben</h3>
      <p className="text-sm text-gray-600 mb-5 text-center">
        Das Wort bekommst du vom Brautpaar.
      </p>
      <label htmlFor="dj-code" className="block text-sm font-medium text-gray-700 mb-1.5">
        <KeyRound size={14} className="inline mr-1" aria-hidden="true" />
        Wort
      </label>
      <input
        id="dj-code"
        type="text"
        value={input}
        onChange={(event) => {
          setInput(event.target.value)
          setError(null)
        }}
        placeholder="zum Beispiel kirsche"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={24}
        className={textFieldClassName}
      />
      {message && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {message}
        </p>
      )}
      <button
        type="submit"
        className="mt-5 w-full px-5 py-3 rounded-xl bg-dark-blue text-white text-sm font-medium hover:bg-dark-blue-light transition-colors"
      >
        Ergebnisse anzeigen
      </button>
    </form>
  )
}

// Ergebnisse für den DJ: auch vor der Freigabe, alle paar Sekunden neu.
export default function WhoResultsPage() {
  // Das Wort kommt aus dem Link oder dem Browser; auf dem Server gibt es es nicht.
  const key = useSyncExternalStore(subscribeResultsKey, takeResultsKey, () => null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Sofort laden, sobald es ein Wort gibt, danach alle paar Sekunden (nicht im
  // versteckten Tab). Ein verworfenes Wort beendet die Abfragen von selbst.
  useEffect(() => {
    if (!key) return
    let active = true

    const load = () => {
      fetch('/api/who-votes', { cache: 'no-store', headers: { 'x-results-key': key } })
        .then(async (res) => {
          if (!active) return
          if (res.status === 429) {
            // Zu viele falsche Wörter von dieser Adresse: nicht weiter anfragen.
            clearResultsKey()
            setSnapshot(null)
            setNotice('Zu viele falsche Wörter. Bitte in ein paar Minuten noch einmal versuchen.')
            return
          }
          if (!res.ok) throw new Error('Laden fehlgeschlagen')
          const data = (await res.json()) as { released?: boolean; questions?: TallyMap | null }
          if (!active) return
          if (!data.questions) {
            // Der Server kennt das Wort nicht: verwerfen, sonst zählt jede Abfrage als Fehlversuch.
            clearResultsKey()
            setSnapshot(null)
            setNotice('Dieses Wort gilt nicht. Bitte noch einmal eingeben.')
            return
          }
          setSnapshot({ released: data.released === true, questions: data.questions })
          setNotice(null)
          setUnreachable(false)
        })
        .catch(() => {
          if (active) setUnreachable(true)
        })
    }

    load()
    const timer = setInterval(() => {
      if (!document.hidden) load()
    }, POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [key])

  let content
  if (!key) {
    content = <CodeForm notice={notice} />
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
