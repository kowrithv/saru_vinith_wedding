import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizPage from './page'

vi.mock('@/components/sections/ClassicQuiz', () => ({
  default: () => <div data-testid="classic-quiz-stub" />,
}))
vi.mock('@/components/sections/WhoKnowsUsGame', () => ({
  default: () => <div data-testid="who-game-stub" />,
}))

describe('QuizPage', () => {
  it('shows the classic quiz by default', () => {
    render(<QuizPage />)
    expect(screen.getByTestId('classic-quiz-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('who-game-stub')).not.toBeInTheDocument()
  })

  it('switches to Wer von uns when that mode is selected', async () => {
    render(<QuizPage />)
    await userEvent.click(screen.getByRole('button', { name: /wer von uns/i }))
    expect(screen.getByTestId('who-game-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('classic-quiz-stub')).not.toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<QuizPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
