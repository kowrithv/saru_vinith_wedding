import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Lotus from './Lotus'

describe('Lotus', () => {
  it('is a decorative image that assistive technology skips', () => {
    const { container } = render(<Lotus />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
  })

  it('takes its size and color from the caller', () => {
    const { container } = render(<Lotus size={48} className="text-gold" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '48')
    expect(svg).toHaveClass('text-gold')
  })
})
