'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { getDeviceId } from '@/lib/device-id'
import { usePolling } from '@/lib/use-polling'
import { useGuestAccess } from '@/lib/use-guest-access'
import { useWhoVotes } from '@/lib/who-local-votes'
import GuestPasswordField from '@/components/ui/GuestPasswordField'
import Lotus from '@/components/ui/Lotus'
import WhoOptionBadge from '@/components/sections/WhoOptionBadge'
import WhoResults, { type TallyMap } from '@/components/sections/WhoResults'
import { cn } from '@/lib/utils'

const VOTE_FAILED_MESSAGE = 'Abstimmen fehlgeschlagen. Bitte versuch es erneut.'

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
      </motion.div>
    )
  }

  const question = whoQuestions[index]
  const myVote = votes[question.id]
  const hasVoted = Boolean(myVote)
  const isLastQuestion = index === whoQuestions.length - 1

  const handleVote = async (option: string) => {
    if (hasVoted || pendingOption !== null) return
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

  const progress = Math.round((index / whoQuestions.length) * 100)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card-ornate rounded-3xl p-6 md:p-8"
      >
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 text-center">
          Frage {index + 1} von {whoQuestions.length}
        </p>
        <div className="h-1 bg-champagne-dark/30 rounded-full overflow-hidden mb-5" aria-hidden="true">
          <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight text-dark-blue mb-6 text-center">
          {question.question}
        </h3>

        <div className="flex flex-col gap-3">
          {whoGameOptions.map((option) => {
            const chosen = option === myVote
            return (
              <button
                key={option}
                type="button"
                disabled={hasVoted || pendingOption !== null}
                aria-pressed={hasVoted ? chosen : undefined}
                onClick={() => handleVote(option)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl border-[1.5px] text-sm font-medium text-left transition-colors',
                  chosen
                    ? 'border-dark-blue bg-champagne/50 text-dark-blue'
                    : hasVoted
                      ? 'border-champagne-dark bg-white text-gray-400'
                      : 'border-champagne-dark bg-white text-gray-700 hover:border-dark-blue hover:bg-champagne/30'
                )}
              >
                <WhoOptionBadge option={option} size={40} className={cn(hasVoted && !chosen && 'opacity-50')} />
                <span className="flex-1">{option}</span>
                {chosen && <Check size={18} className="text-dark-blue flex-shrink-0" aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        {needsPassword && !hasVoted && (
          <div className="mt-5">
            <GuestPasswordField
              id="who-password"
              value={password}
              onChange={setPassword}
              linkRejected={access.linkRejected}
            />
          </div>
        )}

        {hasVoted && (
          <p className="mt-5 text-sm text-center text-gray-600" role="status">
            Deine Stimme ist gespeichert. Die Ergebnisse gibt es nach der Auflösung.
          </p>
        )}

        {voteError && (
          <p className="text-sm text-red-600 mt-4" role="alert">
            {voteError}
          </p>
        )}

        {hasVoted && (
          <button
            type="button"
            onClick={handleNext}
            className="mt-6 w-full px-5 py-3 rounded-xl bg-dark-blue text-white text-sm font-medium hover:bg-dark-blue-light transition-colors"
          >
            {isLastQuestion ? 'Fertig' : 'Weiter'}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
