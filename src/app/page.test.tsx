import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

vi.mock('@/components/sections/Hero', () => ({
  default: () => <div data-testid="hero-stub" />,
}))
vi.mock('@/components/sections/Countdown', () => ({
  default: () => <div data-testid="countdown-stub" />,
}))

describe('HomePage', () => {
  it('renders Hero, Countdown and the feature grid', () => {
    render(<HomePage />)
    expect(screen.getByTestId('hero-stub')).toBeInTheDocument()
    expect(screen.getByTestId('countdown-stub')).toBeInTheDocument()
    expect(screen.getByText('Entdeckt unsere Website')).toBeInTheDocument()
  })
})
