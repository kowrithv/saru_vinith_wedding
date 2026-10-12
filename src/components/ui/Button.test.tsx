import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

describe('Button', () => {
  it('renders its children and responds to clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Weiter</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Weiter
      </Button>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as a submit button when type="submit" is passed', () => {
    render(<Button type="submit">Absenden</Button>)
    expect(screen.getByRole('button', { name: 'Absenden' })).toHaveAttribute('type', 'submit')
  })

  it('defaults to type="button" when no type is passed', () => {
    render(<Button>Weiter</Button>)
    expect(screen.getByRole('button', { name: 'Weiter' })).toHaveAttribute('type', 'button')
  })

  it('renders as a link when href is passed, not a nested button', () => {
    render(<Button href="/info">Zu den Infos</Button>)
    const link = screen.getByRole('link', { name: 'Zu den Infos' })
    expect(link).toHaveAttribute('href', '/info')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
