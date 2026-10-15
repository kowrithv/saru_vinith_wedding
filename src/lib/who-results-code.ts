// Das Wort für die DJ-Seite wird von Hand abgetippt: nur kleine Buchstaben, die
// Eingabe darf in Groß- oder Kleinschreibung und mit Leerzeichen am Rand
// kommen. Server und Browser teilen sich diese Regel.

const WORD_PATTERN = /^[a-z]{3,20}$/

/**
 * Bringt eine Eingabe in die Grundform (klein, ohne Leerzeichen) oder liefert
 * null, wenn sie kein Wort aus Buchstaben sein kann.
 */
export function normalizeResultsCode(input: string): string | null {
  const word = input.trim().toLowerCase()
  return WORD_PATTERN.test(word) ? word : null
}
