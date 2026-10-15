'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'
import Button from '@/components/ui/Button'
import { quizQuestions } from '@/lib/quiz-content'
import { cn } from '@/lib/utils'

function getResultMessage(score: number, total: number): { title: string; message: string } {
  const percentage = (score / total) * 100
  if (percentage === 100) {
    return {
      title: 'Perfekt!',
      message: 'Ihr kennt uns in- und auswendig! Wir freuen uns, euch bei unserer Hochzeit dabei zu haben!',
    }
  } else if (percentage >= 75) {
    return {
      title: 'Sehr gut!',
      message: 'Ihr kennt uns wirklich gut! Wir freuen uns auf euch!',
    }
  } else if (percentage >= 50) {
    return {
      title: 'Gut gemacht!',
      message: 'Mehr als die Hälfte richtig! Lest noch einmal unsere Geschichte und versucht es erneut.',
    }
  }
  return {
    title: 'Noch Luft nach oben!',
    message: 'Lest unsere Geschichte auf der Webseite und versucht es nochmal. Wir freuen uns trotzdem auf euch!',
  }
}

export default function ClassicQuiz() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)

  const currentQuestion = quizQuestions[currentIndex]
  const isAnswered = selectedOption !== null
  const isLastQuestion = currentIndex === quizQuestions.length - 1

  const handleSelectOption = (optionIndex: number) => {
    if (isAnswered) return
    setSelectedOption(optionIndex)
    if (optionIndex === currentQuestion.correctIndex) {
      setScore((prev) => prev + 1)
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResult(true)
      return
    }
    setCurrentIndex((prev) => prev + 1)
    setSelectedOption(null)
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setSelectedOption(null)
    setScore(0)
    setShowResult(false)
  }

  const getOptionStyle = (optionIndex: number) => {
    if (!isAnswered) {
      return 'border-gray-200 bg-white text-gray-700 hover:border-dark-blue hover:bg-champagne/30'
    }
    if (optionIndex === currentQuestion.correctIndex) {
      return 'border-green-400 bg-green-50 text-green-800'
    }
    if (optionIndex === selectedOption) {
      return 'border-red-400 bg-red-50 text-red-800'
    }
    return 'border-gray-100 bg-gray-50 text-gray-400 opacity-60'
  }

  if (showResult) {
    const result = getResultMessage(score, quizQuestions.length)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12"
      >
        <Trophy size={36} className="text-gold mx-auto mb-4" />
        <p className="font-serif text-3xl font-bold text-dark-blue mb-1">
          {score} von {quizQuestions.length}
        </p>
        <h3 className="font-serif text-xl font-semibold text-dark-blue mb-3">{result.title}</h3>
        <p className="text-gray-500 text-sm mb-6">{result.message}</p>
        <Button onClick={handleRestart}>Nochmal versuchen</Button>
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8"
      >
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Frage {currentIndex + 1} von {quizQuestions.length}
        </p>
        <h3 className="font-serif text-lg md:text-xl font-semibold text-dark-blue mb-6">
          {currentQuestion.question}
        </h3>

        <div className="flex flex-col gap-3 mb-6">
          {currentQuestion.options.map((option, optionIndex) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelectOption(optionIndex)}
              className={cn(
                'px-5 py-3 rounded-xl border text-sm font-medium text-left transition-colors',
                getOptionStyle(optionIndex)
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <Button onClick={handleNext} disabled={!isAnswered} className="w-full">
          {isLastQuestion ? 'Ergebnis anzeigen' : 'Weiter'}
        </Button>
      </motion.div>
    </AnimatePresence>
  )
}
