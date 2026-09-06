'use client'

import { useState } from 'react'
import { Save, Eye, EyeOff, ChevronDown, Users2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import { cn } from '@/lib/utils'
import { couple, whoQuestions, whoGameOptions } from '@/lib/config'
import type { WhoGameData } from '@/lib/who-game'

interface WhoGameAdminProps {
  initialData: WhoGameData
}

function optionLabel(option: string): string {
  if (option === couple.bride) return couple.bride
  if (option === couple.groom) return couple.groom
  return option
}

export default function WhoGameAdmin({ initialData }: WhoGameAdminProps) {
  const [data, setData] = useState<WhoGameData>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpanded = (questionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  const setCorrectAnswer = (questionId: string, option: string | null) => {
    setData((prev) => ({
      ...prev,
      questions: {
        ...prev.questions,
        [questionId]: { ...prev.questions[questionId], correctAnswer: option },
      },
    }))
  }

  const toggleRevealed = (questionId: string) => {
    setData((prev) => ({
      ...prev,
      questions: {
        ...prev.questions,
        [questionId]: {
          ...prev.questions[questionId],
          revealed: !prev.questions[questionId].revealed,
        },
      },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const results = await Promise.all(
        whoQuestions.map((q) =>
          fetch('/api/admin/who-votes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: q.id,
              correctAnswer: data.questions[q.id]?.correctAnswer ?? null,
              revealed: Boolean(data.questions[q.id]?.revealed),
            }),
          })
        )
      )
      if (results.some((r) => !r.ok)) {
        toast.error('Speichern teilweise fehlgeschlagen.')
        return
      }
      toast.success('Wer-von-uns-Antworten gespeichert! 💾')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-16">
      <SectionTitle
        title="Wer von uns?"
        subtitle="Legt die richtige Antwort fest, seht wer wie abgestimmt hat, und schaltet die Auflösung live für alle Gäste frei."
        centered={false}
        className="mb-0"
      />

      <div className="space-y-3 mt-8">
        {whoQuestions.map((q) => {
          const state = data.questions[q.id]
          const totalVotes = state ? Object.values(state.tally).reduce((s, n) => s + n, 0) : 0
          const questionVotes = data.votes.filter((v) => v.questionId === q.id)
          const isExpanded = expanded.has(q.id)

          return (
            <Card key={q.id} padding="md">
              <p className="font-medium text-dark-blue text-sm mb-3">{q.question}</p>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                {whoGameOptions.map((option) => {
                  const votes = state?.tally[option] ?? 0
                  const isSelected = state?.correctAnswer === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCorrectAnswer(q.id, isSelected ? null : option)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        isSelected
                          ? 'bg-dark-blue text-white border-dark-blue'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-dark-blue'
                      )}
                    >
                      {optionLabel(option)} · {votes}
                    </button>
                  )
                })}
                <span className="text-xs text-gray-400 ml-1">{totalVotes} Stimmen insgesamt</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => toggleRevealed(q.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
                    state?.revealed
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  )}
                >
                  {state?.revealed ? <Eye size={12} /> : <EyeOff size={12} />}
                  {state?.revealed ? 'Für Gäste sichtbar' : 'Noch verborgen'}
                </button>

                <button
                  type="button"
                  onClick={() => toggleExpanded(q.id)}
                  disabled={questionVotes.length === 0}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-white text-gray-600 border-gray-200 hover:border-dark-blue disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Users2 size={12} />
                  Wer hat wie gestimmt?
                  <ChevronDown size={12} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                </button>
              </div>

              {isExpanded && questionVotes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  {whoGameOptions.map((option) => {
                    const names = questionVotes.filter((v) => v.option === option)
                    return (
                      <div key={option}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          {optionLabel(option)} ({names.length})
                        </p>
                        {names.length === 0 ? (
                          <p className="text-xs text-gray-300 italic">–</p>
                        ) : (
                          <ul className="space-y-1">
                            {names.map((v) => (
                              <li key={v.id} className="text-xs text-gray-600">
                                {v.voterName}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <Button variant="primary" size="lg" onClick={handleSave} disabled={isSaving}>
          <Save size={16} />
          {isSaving ? 'Speichert...' : 'Speichern'}
        </Button>
      </div>
    </div>
  )
}
