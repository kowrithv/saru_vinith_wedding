import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MotionProvider from './MotionProvider'

// Mock-only, bewusst: festgehalten wird die Konfiguration. Das Verhalten
// (Bewegung aus bei "Bewegung reduzieren") liefert framer-motion selbst.
vi.mock('framer-motion', () => ({
  MotionConfig: ({ reducedMotion, children }: { reducedMotion: string; children: React.ReactNode }) => (
    <div data-testid="motion-config" data-reduced-motion={reducedMotion}>
      {children}
    </div>
  ),
}))

describe('MotionProvider', () => {
  it('follows the visitor\'s "reduce motion" setting for all framer-motion animations', () => {
    render(
      <MotionProvider>
        <p>Inhalt</p>
      </MotionProvider>
    )
    expect(screen.getByTestId('motion-config')).toHaveAttribute('data-reduced-motion', 'user')
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })
})
