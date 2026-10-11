'use client'

import { useState } from 'react'
import { Trophy, Users2 } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import ClassicQuiz from '@/components/sections/ClassicQuiz'
import WhoKnowsUsGame from '@/components/sections/WhoKnowsUsGame'
import { cn } from '@/lib/utils'

type Mode = 'classic' | 'who'

export default function QuizPage() {
  const [mode, setMode] = useState<Mode>('classic')

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Hochzeits-Quiz"
          subtitle={
            mode === 'classic'
              ? 'Wie gut kennt ihr uns? Testet euer Wissen in 8 Fragen!'
              : 'Stimmt ab, wer von uns beiden eher zutrifft!'
          }
        />

        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
            <button
              type="button"
              onClick={() => setMode('classic')}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                mode === 'classic' ? 'bg-dark-blue text-white shadow-sm' : 'text-gray-600 hover:text-dark-blue'
              )}
            >
              <Trophy size={15} />
              Klassisches Quiz
            </button>
            <button
              type="button"
              onClick={() => setMode('who')}
              className={cn(
                'px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                mode === 'who' ? 'bg-dark-blue text-white shadow-sm' : 'text-gray-600 hover:text-dark-blue'
              )}
            >
              <Users2 size={15} />
              Wer von uns?
            </button>
          </div>
        </div>

        {mode === 'classic' ? <ClassicQuiz /> : <WhoKnowsUsGame />}
      </div>
    </div>
  )
}
