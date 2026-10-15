import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import QuizPage from './page'

vi.mock('@/components/sections/ClassicQuiz', () => ({
  default: () => <div data-testid="classic-quiz-stub" />,
}))

describe('QuizPage', () => {
  it('shows the classic quiz', () => {
    render(<QuizPage />)
    expect(screen.getByTestId('classic-quiz-stub')).toBeInTheDocument()
  })

  it('points to the separate Wer von uns page instead of embedding it', () => {
    render(<QuizPage />)
    expect(screen.getByRole('link', { name: /wer von uns/i })).toHaveAttribute('href', '/wer-von-uns')
    expect(screen.queryByRole('button', { name: /wer von uns/i })).not.toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<QuizPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
