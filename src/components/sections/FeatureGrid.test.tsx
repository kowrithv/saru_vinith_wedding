import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeatureGrid from './FeatureGrid'
import { homeFeatures } from '@/lib/home-content'

describe('FeatureGrid', () => {
  it('renders every feature as a link to its real route', () => {
    render(<FeatureGrid />)
    homeFeatures.forEach((feature) => {
      const link = screen.getByRole('link', { name: new RegExp(feature.title) })
      expect(link).toHaveAttribute('href', feature.href)
    })
  })
})
