// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useGuestName } from './use-guest-name'

function NameField() {
  const { name } = useGuestName()
  return <input readOnly value={name} />
}

describe('useGuestName (server rendering)', () => {
  // Der Server kennt den gemerkten Namen nicht: das erste Rendern muss leer
  // sein, sonst passt es nicht zur Hydration im Browser.
  it('renders an empty field on the server, without touching window', () => {
    const html = renderToString(<NameField />)
    expect(html).toContain('value=""')
  })
})
