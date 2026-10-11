import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FAQPage from './page'
import { faqItems } from '@/lib/faq-content'

describe('FAQPage', () => {
  it('renders every question', () => {
    render(<FAQPage />)
    faqItems.forEach((item) => {
      expect(screen.getByText(item.question)).toBeInTheDocument()
    })
  })

  it('shows the first answer open by default', () => {
    render(<FAQPage />)
    expect(screen.getByText(faqItems[0].answer)).toBeInTheDocument()
  })

  it('opens a closed question and shows its answer', async () => {
    render(<FAQPage />)
    await userEvent.click(screen.getByText(faqItems[1].question))
    expect(screen.getByText(faqItems[1].answer)).toBeInTheDocument()
  })

  it('closes the previously open answer when another question opens', async () => {
    render(<FAQPage />)
    await userEvent.click(screen.getByText(faqItems[1].question))
    expect(screen.queryByText(faqItems[0].answer)).not.toBeInTheDocument()
  })

  it('collapses an open question when clicked again', async () => {
    render(<FAQPage />)
    await userEvent.click(screen.getByText(faqItems[0].question))
    expect(screen.queryByText(faqItems[0].answer)).not.toBeInTheDocument()
  })

  it('carries its own top offset below the fixed navigation', () => {
    const { container } = render(<FAQPage />)
    expect(container.firstChild).toHaveClass('pt-24')
  })
})
