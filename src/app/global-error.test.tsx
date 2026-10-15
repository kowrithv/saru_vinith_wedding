import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import GlobalError from './global-error'

describe('global error page', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Sie ersetzt das ganze Layout, wenn selbst das scheitert: eigenes <html>,
  // deutscher Text statt der englischen Standardseite von Next.js.
  it('is a complete German page with a way to try again', () => {
    const html = renderToString(<GlobalError error={new Error('boom')} reset={() => {}} />)
    expect(html).toContain('<html lang="de"')
    expect(html).toMatch(/das hat leider nicht geklappt/i)
    expect(html).toMatch(/erneut versuchen/i)
    expect(html).not.toMatch(/application error/i)
  })
})
