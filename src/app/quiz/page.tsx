'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Users2 } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import ClassicQuiz from '@/components/sections/ClassicQuiz'
import WhoKnowsUsGame from '@/components/sections/WhoKnowsUsGame'

type Mode = 'classic' | 'who'

export default function QuizPage() {
  const [mode, setMode] = useState<Mode>('classic')

  return (
    <div className="min-h-screen bg-gradient-to-b from-champagne-light/20 to-white pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionTitle
            title="Hochzeits-Quiz"
            subtitle={
              mode === 'classic'
                ? 'Wie gut kennt ihr uns? Testet euer Wissen in 8 Fragen!'
                : 'Stimmt ab, wer von uns beiden eher zutrifft – die Auflösung gibt es live bei der Feier!'
            }
          />

          {/* Mode switcher */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
              <button
                onClick={() => setMode('classic')}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  mode === 'classic'
                    ? 'bg-dark-blue text-white shadow-sm'
                    : 'text-gray-600 hover:text-dark-blue'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Trophy size={15} />
                  Klassisches Quiz
                </span>
              </button>
              <button
                onClick={() => setMode('who')}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  mode === 'who'
                    ? 'bg-dark-blue text-white shadow-sm'
                    : 'text-gray-600 hover:text-dark-blue'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users2 size={15} />
                  Wer von uns?
                </span>
              </button>
            </div>
          </div>

          {mode === 'classic' ? <ClassicQuiz /> : <WhoKnowsUsGame />}
        </motion.div>
      </div>
    </div>
  )
}
