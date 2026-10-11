import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminLoginForm from './AdminLoginForm'

describe('AdminLoginForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('submits the password and calls onSuccess when the server accepts it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const onSuccess = vi.fn()

    render(<AdminLoginForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText(/Passwort/i), 'geheim123')
    await userEvent.click(screen.getByRole('button', { name: /anmelden/i }))

    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows an error and does not call onSuccess when the password is wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Falsches Passwort.' }) })
    )
    const onSuccess = vi.fn()

    render(<AdminLoginForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText(/Passwort/i), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: /anmelden/i }))

    expect(await screen.findByText('Falsches Passwort.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
