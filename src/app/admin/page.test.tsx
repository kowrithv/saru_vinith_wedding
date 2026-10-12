import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminPage from './page'

interface Locks {
  guestbook: boolean
  memories: boolean
  who_votes: boolean
}

type GalleryMode = 'public' | 'password'

vi.mock('@/components/admin/AdminLoginForm', () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>stub-login-success</button>
  ),
}))
vi.mock('@/components/admin/AdminDashboard', () => ({
  default: ({ initialLocks, initialGalleryMode }: { initialLocks: Locks; initialGalleryMode: GalleryMode }) => (
    <div data-testid="dashboard-stub">{JSON.stringify({ initialLocks, initialGalleryMode })}</div>
  ),
}))

function mockAuthFetch(locksOk: boolean, locks?: Locks, galleryModeOk = true, mode: GalleryMode = 'public') {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/admin/write-lock') {
      return Promise.resolve({ ok: locksOk, status: locksOk ? 200 : 401, json: async () => ({ locks }) })
    }
    if (url === '/api/admin/gallery-mode') {
      return Promise.resolve({ ok: galleryModeOk, status: galleryModeOk ? 200 : 401, json: async () => ({ mode }) })
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  })
}

describe('AdminPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the login form when the admin check fails', async () => {
    vi.stubGlobal('fetch', mockAuthFetch(false))
    render(<AdminPage />)
    await waitFor(() => expect(screen.getByText('stub-login-success')).toBeInTheDocument())
  })

  it('shows the dashboard with the fetched lock status and gallery mode when already authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      mockAuthFetch(true, { guestbook: true, memories: false, who_votes: false }, true, 'password')
    )
    render(<AdminPage />)
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-stub')).toHaveTextContent(
        JSON.stringify({
          initialLocks: { guestbook: true, memories: false, who_votes: false },
          initialGalleryMode: 'password',
        })
      )
    )
  })

  it('switches from login to dashboard after a successful login', async () => {
    vi.stubGlobal('fetch', mockAuthFetch(false))
    render(<AdminPage />)
    const loginButton = await screen.findByText('stub-login-success')

    vi.stubGlobal('fetch', mockAuthFetch(true, { guestbook: false, memories: false, who_votes: false }))
    loginButton.click()

    await waitFor(() => expect(screen.getByTestId('dashboard-stub')).toBeInTheDocument())
  })
})
