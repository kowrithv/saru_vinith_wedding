'use client'

import { useEffect, useState } from 'react'
import { createPreviewImage } from './gallery-preview'

/**
 * Die Vorschau eines gewählten Fotos als Adresse für ein <img> (dieselbe 800-px-Vorschau, die
 * später hochgeladen wird). `undefined`: wird noch erstellt · `null`: keine Vorschau (kein Foto
 * gewählt, oder der Browser kann es nicht dekodieren, z. B. HEIC außerhalb von Safari; das
 * Original wird trotzdem hochgeladen) · sonst die Adresse. Sie wird freigegeben, sobald ein
 * anderes Foto gewählt wird oder die Seite geschlossen ist.
 */
export function useFilePreview(file: File | null): string | null | undefined {
  const [result, setResult] = useState<{ file: File; url: string | null } | null>(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    let objectUrl: string | null = null

    createPreviewImage(file)
      .then(({ blob, isPlaceholder }) => {
        if (cancelled) return
        if (!isPlaceholder && typeof URL.createObjectURL === 'function') objectUrl = URL.createObjectURL(blob)
        setResult({ file, url: objectUrl })
      })
      .catch(() => {
        if (!cancelled) setResult({ file, url: null })
      })

    return () => {
      cancelled = true
      if (objectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  if (!file) return null
  // Ein Ergebnis zählt nur für das Foto, für das es gemacht wurde.
  return result?.file === file ? result.url : undefined
}
