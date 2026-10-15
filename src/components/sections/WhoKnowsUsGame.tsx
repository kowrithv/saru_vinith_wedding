'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { whoQuestions, whoGameOptions, whoBoth } from '@/lib/who-game-content'
import { whoPortraits } from '@/lib/site-images'
import { getDeviceId } from '@/lib/device-id'
import { usePolling } from '@/lib/use-polling'
import { useGuestAccess } from '@/lib/use-guest-access'
import { useWhoVotes } from '@/lib/who-local-votes'
import GuestPasswordField from '@/components/ui/GuestPasswordField'
import Lotus from '@/components/ui/Lotus'
import WhoResults, { type TallyMap } from '@/components/sections/WhoResults'
import { cn } from '@/lib/utils'

const VOTE_FAILED_MESSAGE = 'Abstimmen fehlgeschlagen. Bitte versuch es erneut.'

interface PhotoOptionProps {
  option: string
  chosen: boolean
  /** Es wurde schon abgestimmt: die anderen Fotos treten etwas zurück, bleiben aber antippbar. */
  decided: boolean
  disabled: boolean
  onVote: (option: string) => void
}

// Abgestimmt wird über das Foto: kein Name im Bild. Der Name steht nur im
// Zugänglichkeits-Label (Screenreader, Tests). Die beiden Einzelfotos sind
// quadratisch, "Beide" liegt als breites Foto darunter.
function PhotoOption({ option, chosen, decided, disabled, onVote }: PhotoOptionProps) {
  const url = whoPortraits.get(option)
  const both = option === whoBoth
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={option}
      aria-pressed={decided ? chosen : undefined}
      onClick={() => onVote(option)}
      className={cn(
        'group relative block overflow-hidden rounded-2xl border-2 bg-champagne transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-blue',
        both ? 'col-span-2 aspect-[2/1]' : 'aspect-square',
        chosen
          ? 'border-dark-blue shadow-md'
          : decided
            ? 'border-champagne-dark opacity-70 hover:border-dark-blue hover:opacity-100 active:scale-[0.98]'
            : 'border-champagne-dark hover:border-dark-blue hover:shadow-md active:scale-[0.98]'
      )}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-full w-full object-cover"
        />
      )}
      {chosen && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-dark-blue text-white shadow"
        >
          <Check size={18} />
        </span>
      )}
    </button>
  )
}

interface WhoState {
  released: boolean
  questions: TallyMap | null
}

// Vorab abstimmen, ohne die Ergebnisse zu sehen. Nach der Auflösung, die das
// Brautpaar im Admin-Bereich freigibt, zeigt dieselbe Seite die Verteilung.
export default function WhoKnowsUsGame() {
  const [state, setState] = useState<WhoState | null>(null)
  const { votes, remember } = useWhoVotes()
  const access = useGuestAccess()
  // Das Feld erscheint nur, solange dieser Browser nicht entsperrt ist.
  const needsPassword = access.status === 'locked'
  const [password, setPassword] = useState('')
  const [pendingOption, setPendingOption] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  // Die Frage, die gerade gezeigt wird. Ohne Angabe die erste unbeantwortete;
  // sobald abgestimmt wird, bleibt sie stehen, bis "Weiter" gedrückt wird.
  const [viewIndex, setViewIndex] = useState<number | null>(null)

  usePolling(() => {
    fetch('/api/who-votes', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { released?: boolean; questions?: TallyMap | null } | null) => {
        if (data && typeof data.released === 'boolean') {
          setState({ released: data.released, questions: data.questions ?? null })
        }
      })
      .catch(() => {})
  })

  if (state === null) {
    return (
      <div className="card-ornate rounded-3xl p-8 text-center" role="status">
        <Lotus size={32} className="text-gold mx-auto mb-3" />
        <p className="text-sm text-gray-500">Wird geladen …</p>
      </div>
    )
  }

  if (state.released) {
    return (
      <div>
        <div className="card-ornate rounded-3xl p-6 text-center mb-5">
          <Lotus size={32} className="text-gold mx-auto mb-3" />
          <h3 className="font-display text-2xl font-semibold text-dark-blue mb-1">Die Auflösung</h3>
          <p className="text-sm text-gray-500">
            Die Abstimmung ist beendet. So haben alle Gäste entschieden.
          </p>
        </div>
        {state.questions && <WhoResults tally={state.questions} myVotes={votes} />}
      </div>
    )
  }

  const firstOpen = whoQuestions.findIndex((question) => !votes[question.id])
  const index = viewIndex ?? (firstOpen === -1 ? whoQuestions.length : firstOpen)

  if (index >= whoQuestions.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="card-ornate text-center rounded-3xl p-8 md:p-12"
      >
        <Lotus size={44} className="text-gold mx-auto mb-4" />
        <h3 className="font-display text-3xl font-semibold text-dark-blue mb-2">Danke fürs Mitmachen!</h3>
        <p className="text-gray-500 text-sm">
          Die Auflösung gibt es bei der Feier. Schaut dann einfach wieder hier vorbei.
        </p>
        <button
          type="button"
          onClick={() => setViewIndex(0)}
          className="mt-6 px-5 py-3 rounded-xl border border-champagne-dark bg-white text-sm font-medium text-dark-blue hover:border-dark-blue transition-colors"
        >
          Antworten ansehen und ändern
        </button>
      </motion.div>
    )
  }

  const question = whoQuestions[index]
  const myVote = votes[question.id]
  const hasVoted = Boolean(myVote)
  const isLastQuestion = index === whoQuestions.length - 1

  // Ein weiterer Tipp auf ein anderes Foto ändert die Stimme (bis zur Auflösung).
  const handleVote = async (option: string) => {
    if (pendingOption !== null || option === myVote) return
    setVoteError(null)

    if (needsPassword && !password.trim()) {
      setVoteError('Bitte gib zuerst das Kennwort vom Empfang ein.')
      return
    }

    setPendingOption(option)
    try {
      const response = await fetch('/api/who-votes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          voterId: getDeviceId(),
          option,
          ...(needsPassword ? { password } : {}),
        }),
      })
      if (response.status === 401) {
        // Mit Kennwort: vertippt. Ohne: die gemerkte Sitzung gilt nicht mehr
        // (abgelaufen oder Kennwort gewechselt) - das Feld wieder zeigen.
        setVoteError(needsPassword ? 'Falsches Kennwort.' : 'Bitte gib das Kennwort vom Empfang ein.')
        access.markLocked()
        return
      }
      if (!response.ok) {
        // Nicht bestätigt - nichts lokal vermerken, Gast kann es erneut versuchen.
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setVoteError(data?.error ?? VOTE_FAILED_MESSAGE)
        return
      }
      setViewIndex(index)
      remember(question.id, option)
      setPassword('')
      // Der Server hat mit dem richtigen Kennwort die Sitzung gesetzt.
      if (needsPassword) access.markUnlocked()
    } catch {
      // Netzwerkfehler - nichts lokal vermerken, Gast kann es erneut versuchen.
      setVoteError(VOTE_FAILED_MESSAGE)
    } finally {
      setPendingOption(null)
    }
  }

  const handleNext = () => {
    setVoteError(null)
    setViewIndex(index + 1)
  }

  const handleBack = () => {
    setVoteError(null)
    setViewIndex(Math.max(0, index - 1))
  }

  const progress = Math.round((index / whoQuestions.length) * 100)

  return (
    // Die Karte und die Fotos bleiben stehen: es sind immer dieselben drei Bilder.
    // Nur der Text der Frage wird ausgetauscht und blendet ein.
    <div className="card-ornate rounded-3xl p-6 md:p-8">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 text-center">
        Frage {index + 1} von {whoQuestions.length}
      </p>
      <div className="h-1 bg-champagne-dark/30 rounded-full overflow-hidden mb-5" aria-hidden="true">
        <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      {/* Feste Mindesthöhe (bis zu drei Zeilen): die Fotos darunter springen nicht,
          wenn die nächste Frage kürzer oder länger ist. */}
      <motion.div
        key={question.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex min-h-24 flex-col items-center justify-center"
      >
        <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight text-dark-blue text-center">
          {question.question}
        </h3>
      </motion.div>
      <p className="text-sm text-gray-500 mt-2 mb-5 text-center">Tippe auf das Foto.</p>

      <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
        {whoGameOptions.map((option) => (
          <PhotoOption
            key={option}
            option={option}
            chosen={option === myVote}
            decided={hasVoted}
            disabled={pendingOption !== null}
            onVote={handleVote}
          />
        ))}
      </div>

      {needsPassword && (
        <div className="mt-5">
          <GuestPasswordField
            id="who-password"
            value={password}
            onChange={setPassword}
            linkRejected={access.linkRejected}
          />
        </div>
      )}

      {/* Sichtbar bestätigt der Haken auf dem Foto, dazu kommt "Weiter". Ein Satz
          nach jeder der 14 Fragen wäre zu viel; wann es Ergebnisse gibt, steht
          oben auf der Seite und am Ende. Nur für Screenreader wird angesagt. */}
      {hasVoted && (
        <p className="sr-only" role="status">
          Deine Stimme ist gespeichert.
        </p>
      )}

      {voteError && (
        <p className="text-sm text-red-600 mt-4" role="alert">
          {voteError}
        </p>
      )}

      {/* Der Platz für "Zurück" und "Weiter" ist von Anfang an da (unsichtbar, solange
          sie nicht gebraucht werden): die Karte wächst nicht, wenn ein Knopf erscheint. */}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={index === 0}
          tabIndex={index === 0 ? -1 : undefined}
          aria-hidden={index === 0 ? true : undefined}
          className={cn(
            'px-5 py-3 rounded-xl border border-champagne-dark bg-white text-sm font-medium text-dark-blue hover:border-dark-blue transition-colors',
            index === 0 && 'invisible'
          )}
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!hasVoted}
          tabIndex={hasVoted ? undefined : -1}
          aria-hidden={hasVoted ? undefined : true}
          className={cn(
            'flex-1 px-5 py-3 rounded-xl bg-dark-blue text-white text-sm font-medium hover:bg-dark-blue-light transition-colors',
            !hasVoted && 'invisible'
          )}
        >
          {isLastQuestion ? 'Fertig' : 'Weiter'}
        </button>
      </div>
    </div>
  )
}
