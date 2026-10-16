import type { CSSProperties } from 'react'

/**
 * Farben der Punktestand-Seiten: Beamer (`/beamer`) und Steuerung (`/punkte`) zeigen dieselben
 * Teamfarben, damit der Knopf, den man drückt, zur Farbe auf dem Bildschirm passt.
 * Bride in Pink, Groom in Bordeaux (nach dem Bordeaux der Seite), Hintergrund in Champagner.
 */
export const SCORE_COLORS = {
  bride: '#d6637f',
  brideTape: '#f5cdd6',
  groom: '#8a2a3b',
  groomTape: '#d9bcb4',
  backdropCenter: '#ebe1c8',
  backdropEdge: '#dbcdac',
} as const

/** Als CSS-Variablen auf das äußerste Element setzen; die Klassen lesen sie mit `var(--bride)` usw. */
export const SCORE_CSS_VARS = {
  '--bride': SCORE_COLORS.bride,
  '--bride-tape': SCORE_COLORS.brideTape,
  '--groom': SCORE_COLORS.groom,
  '--groom-tape': SCORE_COLORS.groomTape,
  '--backdrop-center': SCORE_COLORS.backdropCenter,
  '--backdrop-edge': SCORE_COLORS.backdropEdge,
} as CSSProperties
