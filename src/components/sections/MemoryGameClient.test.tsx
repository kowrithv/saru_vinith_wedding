// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import MemoryGameClient from './MemoryGameClient'

describe('MemoryGameClient (server rendering)', () => {
  it('renders no card markup server-side, since the random deal must only happen on the client', () => {
    const html = renderToString(<MemoryGameClient />)
    expect(html).not.toMatch(/memory-spiel\/memory-/)
  })
})
