'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

export default function AdminLoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        toast.error(data?.error || 'Falsches Passwort.')
        return
      }

      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-champagne-light/20 to-white pt-24 pb-16 flex items-center">
      <div className="max-w-sm mx-auto px-4 sm:px-6 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionTitle title="Admin-Bereich" subtitle="Bitte mit dem Admin-Passwort anmelden." />

          <Card padding="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="w-12 h-12 bg-champagne rounded-xl flex items-center justify-center mx-auto">
                <Lock size={20} className="text-dark-blue" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <KeyRound size={14} className="inline mr-1" />
                  Passwort
                </label>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                  placeholder="••••••••"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting || password.length === 0}
              >
                {isSubmitting ? 'Wird geprüft...' : 'Anmelden'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
