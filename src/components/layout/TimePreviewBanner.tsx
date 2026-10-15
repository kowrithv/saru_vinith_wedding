'use client'

import { useSyncExternalStore } from 'react'
import { PREVIEWS, PREVIEW_EVENT, endPreview, previewKey, type PreviewKey } from '@/lib/time-preview'

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PREVIEW_EVENT, onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener(PREVIEW_EVENT, onChange)
    window.removeEventListener('popstate', onChange)
  }
}

function getServerKey(): PreviewKey | null {
  return null
}

// Erscheint nur, wenn die Seite über ?zeit=… in einen Tageszustand versetzt
// wurde: damit niemand die Vorschau mit dem echten Zustand verwechselt.
export default function TimePreviewBanner() {
  const key = useSyncExternalStore(subscribe, previewKey, getServerKey)
  if (key === null) return null
  const label = PREVIEWS.get(key)?.label ?? ''

  return (
    <div
      role="status"
      className="fixed bottom-3 left-3 z-[60] flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full bg-dark-blue px-4 py-2 text-xs text-white shadow-lg"
    >
      <span>Vorschau: {label}</span>
      <button
        type="button"
        onClick={endPreview}
        className="rounded-full bg-gold px-3 py-1 font-semibold text-dark-blue-dark hover:bg-gold-light"
      >
        Beenden
      </button>
    </div>
  )
}
