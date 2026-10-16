import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteChrome from './SiteChrome'

const navigation = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

function renderAt(pathname: string) {
  navigation.pathname = pathname
  return render(
    <SiteChrome
      navigation={<nav aria-label="Hauptmenü">Menü</nav>}
      footer={<footer>Fußzeile</footer>}
      banner={<div role="status">Zeit-Vorschau</div>}
    >
      <p>Inhalt der Seite</p>
    </SiteChrome>
  )
}

describe('SiteChrome', () => {
  afterEach(() => {
    navigation.pathname = '/'
  })

  it.each(['/', '/gallery', '/info', '/admin', '/dj', '/memories'])('wraps %s in navigation, main and footer', (path) => {
    renderAt(path)
    expect(screen.getByRole('navigation', { name: 'Hauptmenü' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Inhalt der Seite')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Fußzeile')
    expect(screen.getByRole('status')).toHaveTextContent('Zeit-Vorschau')
  })

  it.each(['/beamer', '/punkte', '/beamer/', '/punkte/'])(
    'shows %s on its own, with nothing of the site around or beneath it',
    (path) => {
      renderAt(path)
      expect(screen.getByText('Inhalt der Seite')).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByRole('main')).not.toBeInTheDocument()
    }
  )

  it('only switches the exact pages off, not paths that merely start the same way', () => {
    renderAt('/beamer-info')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
