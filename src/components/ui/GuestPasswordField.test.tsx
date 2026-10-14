import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestPasswordField from './GuestPasswordField'

describe('GuestPasswordField', () => {
  it('is labelled like the reception card and reports typed text', async () => {
    const onChange = vi.fn()
    render(<GuestPasswordField id="pw" value="" onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Kennwort vom Empfang'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('points to the QR code as the easy way', () => {
    render(<GuestPasswordField id="pw" value="" onChange={() => {}} />)
    expect(screen.getByText(/QR-Code/)).toBeInTheDocument()
  })

  it('shows the typed text and turns off phone auto-capitalisation and auto-correction', () => {
    render(<GuestPasswordField id="pw" value="Hochzeit" onChange={() => {}} />)
    const input = screen.getByLabelText('Kennwort vom Empfang')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
    expect(input).toHaveValue('Hochzeit')
  })

  it('explains a rejected link only when asked to', () => {
    const { rerender } = render(<GuestPasswordField id="pw" value="" onChange={() => {}} />)
    expect(screen.queryByText(/nicht mehr gültig/i)).not.toBeInTheDocument()

    rerender(<GuestPasswordField id="pw" value="" onChange={() => {}} linkRejected />)
    expect(screen.getByText(/nicht mehr gültig/i)).toBeInTheDocument()
  })
})
