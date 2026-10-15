'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import Lotus from '@/components/ui/Lotus'
import { quizQuestions } from '@/lib/quiz-content'
import { cn } from '@/lib/utils'

function getResultMessage(score: number, total: number): { title: string; message: string } {
  const percentage = (score / total) * 100
  if (percentage === 100) {
    return {
      title: 'Perfekt!',
      message: 'Ihr kennt uns in- und auswendig! Wir freuen uns, euch bei unserer Hochzeit dabei zu haben!',
    }
  } else if (total - score === 1) {
    return {
      title: 'Fast perfekt!',
      message: 'Ihr kennt uns richtig gut. Nur eine Frage ging daneben.',
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

// Punktzahl im goldenen Ring (zwei feine Kreise, der äußere gepunktet).
function ScoreRing({ score, total }: { score: number; total: number }) {
  return (
    <div data-testid="quiz-score-ring" className="relative mx-auto grid h-28 w-28 place-items-center text-gold">
      <svg
        viewBox="-30 -30 60 60"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.85}
      >
        <circle r={27} />
        <circle r={23} strokeDasharray="1 4" strokeLinecap="round" />
      </svg>
      <b aria-hidden="true" className="relative font-display text-4xl font-semibold text-dark-blue">
        {score}/{total}
      </b>
      <span className="sr-only">
        {score} von {total}
      </span>
    </div>
  )
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
      return 'border-champagne-dark bg-white text-gray-700 hover:border-dark-blue hover:bg-champagne/30'
    }
    if (optionIndex === currentQuestion.correctIndex) {
      return 'border-green-600 bg-green-50 text-green-900'
    }
    if (optionIndex === selectedOption) {
      return 'border-bordeaux bg-rose-sand-light text-bordeaux'
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
        className="card-ornate text-center rounded-3xl p-8 md:p-12"
      >
        <ScoreRing score={score} total={quizQuestions.length} />
        <h3 className="mt-4 mb-2 font-display text-3xl font-semibold text-dark-blue">{result.title}</h3>
        <p className="mx-auto mb-6 max-w-sm text-sm text-gray-600">{result.message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={handleRestart}>Nochmal versuchen</Button>
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center rounded-full border-2 border-dark-blue px-6 py-2.5 text-sm font-medium text-dark-blue transition-colors hover:bg-dark-blue hover:text-white"
          >
            Zur Galerie
          </Link>
        </div>
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
        className="card-ornate rounded-3xl p-6 md:p-8"
      >
        <div data-testid="quiz-progress" className="mb-4 flex justify-center gap-1.5" aria-hidden="true">
          {quizQuestions.map((question, index) => (
            <Lotus
              key={question.id}
              size={18}
              className={index <= currentIndex ? 'text-gold' : 'text-champagne-dark'}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 text-center">
          Frage {currentIndex + 1} von {quizQuestions.length}
        </p>
        <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight text-dark-blue mb-6 text-center">
          {currentQuestion.question}
        </h3>

        <div className="flex flex-col gap-3 mb-6">
          {currentQuestion.options.map((option, optionIndex) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelectOption(optionIndex)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border-[1.5px] text-sm font-medium text-left transition-colors',
                getOptionStyle(optionIndex)
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-champagne text-xs font-bold text-dark-blue"
              >
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <span className="flex-1">{option}</span>
              {isAnswered && optionIndex === currentQuestion.correctIndex && (
                <Check size={18} className="flex-shrink-0 text-green-700" />
              )}
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
