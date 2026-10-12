import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CollapsibleSection from './CollapsibleSection'

function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount((c) => c + 1)}>count {count}</button>
}

describe('CollapsibleSection', () => {
  it('is closed by default and exposes its state', () => {
    render(
      <CollapsibleSection id="demo" title="Gästebuch" count={3}>
        <p>Inhalt</p>
      </CollapsibleSection>
    )
    const toggle = screen.getByRole('button', { name: /gästebuch \(3\)/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Inhalt')).not.toBeVisible()
  })

  it('can start open', () => {
    render(
      <CollapsibleSection id="demo" title="Galerie" defaultOpen>
        <p>Inhalt</p>
      </CollapsibleSection>
    )
    expect(screen.getByRole('button', { name: /galerie/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Inhalt')).toBeVisible()
  })

  it('toggles on click and is a labelled region', async () => {
    render(
      <CollapsibleSection id="demo" title="Erinnerungen">
        <p>Inhalt</p>
      </CollapsibleSection>
    )
    await userEvent.click(screen.getByRole('button', { name: /erinnerungen/i }))

    expect(screen.getByText('Inhalt')).toBeVisible()
    expect(screen.getByRole('region', { name: /erinnerungen/i })).toBeInTheDocument()
  })

  it('keeps the state of its children while collapsed', async () => {
    render(
      <CollapsibleSection id="demo" title="Galerie" defaultOpen>
        <Counter />
      </CollapsibleSection>
    )
    await userEvent.click(screen.getByRole('button', { name: 'count 0' }))
    await userEvent.click(screen.getByRole('button', { name: /galerie/i }))
    await userEvent.click(screen.getByRole('button', { name: /galerie/i }))

    expect(screen.getByRole('button', { name: 'count 1' })).toBeInTheDocument()
  })
})
