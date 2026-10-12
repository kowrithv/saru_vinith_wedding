// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import Countdown from './Countdown'

describe('Countdown (server rendering)', () => {
  it('renders the skeleton, not a specific digit value, when there is no window (matches real SSR)', () => {
    const html = renderToString(<Countdown />)
    expect(html).toContain('animate-pulse')
    expect(html).not.toContain('Tage')
  })
})
