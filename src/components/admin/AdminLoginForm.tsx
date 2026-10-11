'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

interface AdminLoginFormProps {
  onSuccess: () => void
}

export default function AdminLoginForm({ onSuccess }: AdminLoginFormProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Anmeldung fehlgeschlagen.')
        return
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-24 pb-16 flex items-center">
      <div className="max-w-sm mx-auto px-4 sm:px-6 w-full">
        <SectionTitle title="Admin-Bereich" subtitle="Bitte mit dem Admin-Passwort anmelden." />

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="w-12 h-12 bg-champagne rounded-xl flex items-center justify-center mx-auto">
              <Lock size={20} className="text-dark-blue" />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                <KeyRound size={14} className="inline mr-1" />
                Passwort
              </label>
              <input
                id="admin-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" size="lg" disabled={submitting || password.length === 0} className="w-full">
              {submitting ? 'Wird geprüft...' : 'Anmelden'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
