import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminPage from './page'

vi.mock('@/components/admin/AdminLoginForm', () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>stub-login-success</button>
  ),
}))
vi.mock('@/components/admin/AdminDashboard', () => ({
  default: ({ initialLocks }: { initialLocks: { guestbook: boolean; memories: boolean; who_votes: boolean } }) => (
    <div data-testid="dashboard-stub">{JSON.stringify(initialLocks)}</div>
  ),
}))

describe('AdminPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the login form when the admin check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('stub-login-success')).toBeInTheDocument())
  })

  it('shows the dashboard with the fetched lock status when already authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ locks: { guestbook: true, memories: false, who_votes: false } }),
      })
    )
    render(<AdminPage />)
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-stub')).toHaveTextContent(
        JSON.stringify({ guestbook: true, memories: false, who_votes: false })
      )
    )
  })

  it('switches from login to dashboard after a successful login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<AdminPage />)
    const loginButton = await screen.findByText('stub-login-success')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ locks: { guestbook: false, memories: false, who_votes: false } }),
      })
    )
    loginButton.click()

    await waitFor(() => expect(screen.getByTestId('dashboard-stub')).toBeInTheDocument())
  })
})
