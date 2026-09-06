'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Trophy, RefreshCw, ChevronRight, Heart } from 'lucide-react'
import Button from '@/components/ui/Button'
import HeartBurst from '@/components/ui/HeartBurst'
import { quizQuestions } from '@/lib/config'

type AnswerState = 'unanswered' | 'correct' | 'wrong'

interface QuizState {
  currentIndex: number
  selectedOption: number | null
  answers: AnswerState[]
  score: number
  showResult: boolean
}

function getResultMessage(score: number, total: number): { title: string; message: string } {
  const percentage = (score / total) * 100
  if (percentage === 100) {
    return {
      title: 'Perfekt! 🎉',
      message: 'Ihr kennt uns in- und auswendig! Wir sind gerührt – danke, dass ihr so aufmerksam seid. Wir freuen uns, euch bei unserer Hochzeit dabei zu haben!',
    }
  } else if (percentage >= 75) {
    return {
      title: 'Sehr gut! 🌟',
      message: 'Ihr kennt uns wirklich gut! Fast alle Fragen richtig beantwortet – das zeigt, wie sehr ihr uns am Herzen liegt. Wir freuen uns auf euch!',
    }
  } else if (percentage >= 50) {
    return {
      title: 'Gut gemacht! 💙',
      message: 'Ihr habt mehr als die Hälfte richtig! Lest noch einmal unsere Geschichte und versucht es erneut – oder kommt zur Hochzeit und lernt uns noch besser kennen!',
    }
  } else {
    return {
      title: 'Noch Luft nach oben! 😊',
      message: 'Das ist euer erster Versuch – kein Problem! Lest unsere Geschichte auf der Webseite und versucht es nochmal. Wir freuen uns trotzdem auf euch!',
    }
  }
}

export default function ClassicQuiz() {
  const [state, setState] = useState<QuizState>({
    currentIndex: 0,
    selectedOption: null,
    answers: new Array(quizQuestions.length).fill('unanswered'),
    score: 0,
    showResult: false,
  })
  const [burstTrigger, setBurstTrigger] = useState(0)

  useEffect(() => {
    if (state.showResult && state.score === quizQuestions.length) {
      setBurstTrigger((t) => t + 1)
    }
  }, [state.showResult, state.score])

  const currentQuestion = quizQuestions[state.currentIndex]
  const isAnswered = state.selectedOption !== null
  const isLastQuestion = state.currentIndex === quizQuestions.length - 1

  const handleSelectOption = (optionIndex: number) => {
    if (isAnswered) return

    const isCorrect = optionIndex === currentQuestion.correctIndex
    const newAnswers = [...state.answers]
    newAnswers[state.currentIndex] = isCorrect ? 'correct' : 'wrong'

    setState((prev) => ({
      ...prev,
      selectedOption: optionIndex,
      answers: newAnswers,
      score: isCorrect ? prev.score + 1 : prev.score,
    }))
  }

  const handleNext = () => {
    if (isLastQuestion) {
      setState((prev) => ({ ...prev, showResult: true }))
      return
    }
    setState((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      selectedOption: null,
    }))
  }

  const handleRestart = () => {
    setState({
      currentIndex: 0,
      selectedOption: null,
      answers: new Array(quizQuestions.length).fill('unanswered'),
      score: 0,
      showResult: false,
    })
  }

  const getOptionStyle = (optionIndex: number) => {
    if (!isAnswered) {
      return 'border-gray-200 bg-white text-gray-700 hover:border-dark-blue hover:bg-champagne/30 cursor-pointer'
    }
    if (optionIndex === currentQuestion.correctIndex) {
      return 'border-green-400 bg-green-50 text-green-800'
    }
    if (optionIndex === state.selectedOption && !isAnswered) {
      return 'border-gray-200 bg-white'
    }
    if (optionIndex === state.selectedOption) {
      return 'border-red-400 bg-red-50 text-red-800'
    }
    return 'border-gray-100 bg-gray-50 text-gray-400 opacity-60'
  }

  const resultData = getResultMessage(state.score, quizQuestions.length)

  return (
    <>
      <HeartBurst trigger={burstTrigger} />
      <AnimatePresence mode="wait">
        {state.showResult ? (
          /* Results Screen */
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, type: 'spring', damping: 20 }}
            className="text-center"
          >
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
              {/* Trophy icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                className="w-20 h-20 bg-champagne rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Trophy size={36} className="text-gold" />
              </motion.div>

              {/* Score */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-4"
              >
                <p className="font-serif text-5xl md:text-6xl font-semibold text-dark-blue">
                  {state.score} / {quizQuestions.length}
                </p>
                <div className="flex justify-center mt-2 gap-1">
                  {state.answers.map((answer, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full ${
                        answer === 'correct' ? 'bg-green-400' : 'bg-red-300'
                      }`}
                    />
                  ))}
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="font-serif text-2xl font-semibold text-dark-blue mb-3"
              >
                {resultData.title}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-600 text-sm md:text-base leading-relaxed mb-8"
              >
                {resultData.message}
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-3 justify-center"
              >
                <Button variant="primary" size="lg" onClick={handleRestart}>
                  <RefreshCw size={16} />
                  Nochmal versuchen
                </Button>
                <Button variant="secondary" size="lg" onClick={() => window.location.href = '/story'}>
                  <Heart size={16} />
                  Unsere Geschichte lesen
                </Button>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          /* Question Screen */
          <motion.div
            key={`question-${state.currentIndex}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">
                  Frage {state.currentIndex + 1} von {quizQuestions.length}
                </span>
                <span className="text-sm font-medium text-dark-blue">
                  {state.score} richtig
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-dark-blue to-baby-blue rounded-full"
                  initial={{ width: `${(state.currentIndex / quizQuestions.length) * 100}%` }}
                  animate={{ width: `${((state.currentIndex + 1) / quizQuestions.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
              {/* Step dots */}
              <div className="flex justify-between mt-2">
                {quizQuestions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                      i < state.currentIndex
                        ? state.answers[i] === 'correct'
                          ? 'bg-green-400'
                          : 'bg-red-300'
                        : i === state.currentIndex
                        ? 'bg-dark-blue'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
              {/* Question number badge */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-dark-blue rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">{state.currentIndex + 1}</span>
                </div>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              {/* Question text */}
              <h2 className="font-serif text-xl md:text-2xl font-semibold text-dark-blue mb-6 leading-snug">
                {currentQuestion.question}
              </h2>

              {/* Options */}
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = state.selectedOption === index
                  const isCorrectOption = index === currentQuestion.correctIndex

                  return (
                    <motion.button
                      key={index}
                      whileHover={!isAnswered ? { scale: 1.01 } : {}}
                      whileTap={!isAnswered ? { scale: 0.99 } : {}}
                      onClick={() => handleSelectOption(index)}
                      disabled={isAnswered}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${getOptionStyle(index)} flex items-center justify-between gap-3`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          isAnswered && isCorrectOption
                            ? 'border-green-400 bg-green-400 text-white'
                            : isAnswered && isSelected && !isCorrectOption
                            ? 'border-red-400 bg-red-400 text-white'
                            : 'border-current'
                        }`}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className="text-sm md:text-base">{option}</span>
                      </div>
                      {isAnswered && (
                        <div className="flex-shrink-0">
                          {isCorrectOption ? (
                            <CheckCircle size={20} className="text-green-500" />
                          ) : isSelected ? (
                            <XCircle size={20} className="text-red-400" />
                          ) : null}
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>

              {/* Answer feedback */}
              <AnimatePresence>
                {isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mb-4 p-3 rounded-xl text-sm font-medium ${
                      state.selectedOption === currentQuestion.correctIndex
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {state.selectedOption === currentQuestion.correctIndex
                      ? '✓ Richtig! Gut gemacht!'
                      : `✗ Leider falsch. Die richtige Antwort ist: "${currentQuestion.options[currentQuestion.correctIndex]}"`}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Next button */}
              <AnimatePresence>
                {isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={handleNext}
                    >
                      {isLastQuestion ? (
                        <>
                          Ergebnis ansehen
                          <Trophy size={16} />
                        </>
                      ) : (
                        <>
                          Nächste Frage
                          <ChevronRight size={16} />
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
