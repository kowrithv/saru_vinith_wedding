'use client'

import { useEffect, useRef } from 'react'

interface ShowMoreButtonProps {
  /** Beschriftung, z. B. "60 weitere Fotos anzeigen". */
  label: string
  onClick: () => void
}

// Lange Listen werden stückweise gezeigt (Galerie, Gästebuch, Erinnerungen):
// am Fest kommen Hunderte Einträge und Tausende Fotos zusammen. Die nächste
// Portion lädt von selbst nach, sobald der Knopf in die Nähe des Bildschirms
// kommt (Infinite Scroll); der Knopf bleibt als Rückfall für Tastatur, ältere
// Browser und jeden Fall, in dem das Beobachten nicht greift.
//
// Der Aufrufer setzt `key` auf die Zahl der gezeigten Einträge: nach jeder
// Portion entsteht so ein neuer Beobachter, der sofort meldet, ob der Knopf noch
// in Sichtweite ist (kurze Seiten füllen sich dann bis zum Rand).
export default function ShowMoreButton({ label, onClick }: ShowMoreButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const onClickRef = useRef(onClick)

  useEffect(() => {
    onClickRef.current = onClick
  }, [onClick])

  useEffect(() => {
    const element = buttonRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return

    let triggered = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (triggered || !entries.some((entry) => entry.isIntersecting)) return
        // Eine Portion je Erscheinen: danach übernimmt der neue Beobachter.
        triggered = true
        onClickRef.current()
      },
      // Schon vorladen, wenn der Knopf noch eine Bildschirmhöhe entfernt ist.
      { rootMargin: '600px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="mt-6 flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className="rounded-full border-2 border-dark-blue px-6 py-2.5 text-sm font-medium text-dark-blue transition-colors hover:bg-dark-blue hover:text-white"
      >
        {label}
      </button>
    </div>
  )
}
