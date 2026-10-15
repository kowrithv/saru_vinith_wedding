import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClassicQuiz from './ClassicQuiz'
import { quizQuestions } from '@/lib/quiz-content'

async function answerCurrentQuestion(index: number, chooseCorrect: boolean) {
  const question = quizQuestions[index]
  const optionIndex = chooseCorrect
    ? question.correctIndex
    : (question.correctIndex + 1) % question.options.length
  await userEvent.click(screen.getByRole('button', { name: question.options[optionIndex] }))
}

describe('ClassicQuiz', () => {
  it('renders the first question with all its options', () => {
    render(<ClassicQuiz />)
    expect(screen.getByText(quizQuestions[0].question)).toBeInTheDocument()
    quizQuestions[0].options.forEach((option) => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    })
  })

  it('ignores a second click on a different option once the question is answered', async () => {
    render(<ClassicQuiz />)
    await answerCurrentQuestion(0, true)
    const wrongOption = quizQuestions[0].options[(quizQuestions[0].correctIndex + 1) % 4]
    await userEvent.click(screen.getByRole('button', { name: wrongOption }))

    await userEvent.click(screen.getByRole('button', { name: /weiter/i }))
    for (let i = 1; i < quizQuestions.length; i++) {
      await answerCurrentQuestion(i, false)
      await userEvent.click(screen.getByRole('button', { name: /weiter|ergebnis/i }))
    }
    // Score wäre 2 statt 1, wenn der zweite (ignorierte) Klick gezählt hätte.
    expect(screen.getByText(/^1 von 8$/)).toBeInTheDocument()
  })

  it('advances through all questions and shows the final score', async () => {
    render(<ClassicQuiz />)
    for (let i = 0; i < quizQuestions.length; i++) {
      await answerCurrentQuestion(i, true)
      await userEvent.click(screen.getByRole('button', { name: /weiter|ergebnis/i }))
    }
    expect(screen.getByText(`${quizQuestions.length} von ${quizQuestions.length}`)).toBeInTheDocument()
  })

  it('restarts from the first question', async () => {
    render(<ClassicQuiz />)
    for (let i = 0; i < quizQuestions.length; i++) {
      await answerCurrentQuestion(i, true)
      await userEvent.click(screen.getByRole('button', { name: /weiter|ergebnis/i }))
    }
    await userEvent.click(screen.getByRole('button', { name: /nochmal/i }))
    expect(screen.getByText(quizQuestions[0].question)).toBeInTheDocument()
  })

  it('shows the progress as one lotus per question, filled up to the current one', async () => {
    render(<ClassicQuiz />)
    const progress = screen.getByTestId('quiz-progress')
    expect(progress.querySelectorAll('svg')).toHaveLength(quizQuestions.length)
    expect(progress.querySelectorAll('svg.text-gold')).toHaveLength(1)

    await answerCurrentQuestion(0, true)
    await userEvent.click(screen.getByRole('button', { name: /weiter/i }))

    // Die nächste Frage ersetzt die Karte: den Fortschritt neu abfragen.
    await waitFor(() =>
      expect(screen.getByTestId('quiz-progress').querySelectorAll('svg.text-gold')).toHaveLength(2)
    )
  })

  it('marks the options with letters that assistive technology skips', () => {
    render(<ClassicQuiz />)
    const first = screen.getByRole('button', { name: quizQuestions[0].options[0] })
    expect(first.querySelector('[aria-hidden="true"]')).toHaveTextContent('A')
  })

  it('shows a checkmark next to the correct answer, not only a color', async () => {
    render(<ClassicQuiz />)
    const correct = quizQuestions[0].correctIndex
    await answerCurrentQuestion(0, false)

    const correctButton = screen.getByRole('button', { name: quizQuestions[0].options[correct] })
    expect(correctButton.querySelector('svg')).toBeInTheDocument()
  })
})
