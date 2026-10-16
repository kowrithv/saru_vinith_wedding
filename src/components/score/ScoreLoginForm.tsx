'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { textFieldClassName } from '@/lib/form-styles'
import ScoreScreen from './ScoreScreen'

interface ScoreLoginFormProps {
  title: string
  onSuccess: () => void
}

export default function ScoreLoginForm({ title, onSuccess }: ScoreLoginFormProps) {
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
    <ScoreScreen>
      <div className="flex min-h-full items-center px-4 py-10">
        <div className="mx-auto w-full max-w-sm">
          <Card padding="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-champagne">
                <Lock size={20} className="text-dark-blue" aria-hidden="true" />
              </div>
              <h1 className="text-center font-display text-2xl font-semibold text-dark-blue">{title}</h1>

              <div>
                <label htmlFor="score-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  <KeyRound size={14} className="mr-1 inline" aria-hidden="true" />
                  Passwort
                </label>
                <input
                  id="score-password"
                  type="password"
                  autoFocus
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={textFieldClassName}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={submitting || password.length === 0} className="w-full">
                {submitting ? 'Wird geprüft...' : 'Anmelden'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </ScoreScreen>
  )
}
