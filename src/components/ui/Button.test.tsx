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
})
