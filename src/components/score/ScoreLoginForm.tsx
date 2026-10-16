'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { textFieldClassName } from '@/lib/form-styles'
import { cn } from '@/lib/utils'
import ScoreScreen from './ScoreScreen'

interface ScoreLoginFormProps {
  title: string
  onSuccess: () => void
  /** `beamer`: Hintergrund wie die Anzeige. */
  variant?: 'plain' | 'beamer'
}

export default function ScoreLoginForm({ title, onSuccess, variant = 'plain' }: ScoreLoginFormProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/score/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Anmeldung fehlgeschlagen.')
        return
      }
      onSuccess()
    } catch {
      setError('Keine Verbindung. Bitte noch einmal versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScoreScreen variant={variant}>
      {/* Alle Maße in em: die Schriftgröße wächst mit der kürzeren Bildschirmseite (cqmin), am Beamer
          ist das Fenster damit gut lesbar, am Handy bleibt es bei der normalen Größe (mindestens 16 px). */}
      <div className="grid h-full w-full place-items-center px-4 py-6 [container-type:size]">
        <div className="w-[min(22em,100%)] text-[clamp(1rem,2.4cqmin,2.2rem)]">
          <Card padding="none" className="p-[2em]">
            <form onSubmit={handleSubmit} className="space-y-[1.2em]">
              <div className="mx-auto flex h-[3em] w-[3em] items-center justify-center rounded-xl bg-champagne">
                <Lock size="1.25em" className="text-dark-blue" aria-hidden="true" />
              </div>
              <h1 className="text-center font-display text-[1.6em] font-semibold text-dark-blue">{title}</h1>

              <div>
                <label htmlFor="score-password" className="mb-[0.4em] block text-[0.9em] font-medium text-gray-700">
                  <KeyRound size="0.9em" className="mr-1 inline" aria-hidden="true" />
                  Passwort
                </label>
                <input
                  id="score-password"
                  type="password"
                  autoFocus
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={cn(textFieldClassName, 'px-[0.9em] py-[0.6em] text-[1em]')}
                />
              </div>

              {error && (
                <p role="alert" className="text-[0.9em] text-red-600">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={submitting || password.length === 0}
                className="w-full px-[1.5em] py-[0.7em] text-[1em]"
              >
                {submitting ? 'Wird geprüft...' : 'Anmelden'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </ScoreScreen>
  )
}
