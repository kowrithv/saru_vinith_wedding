import { ArrowUp } from 'lucide-react'

interface NewItemsButtonProps {
  count: number
  /** z. B. "neuer Eintrag" / "neue Einträge". */
  singular: string
  plural: string
  onClick: () => void
}

// "N neue ... anzeigen": erscheint, wenn die Seite Neues kennt, der Gast aber weiter
// unten ist und nichts springen soll. Bleibt beim Scrollen unter der Navigation stehen.
export default function NewItemsButton({ count, singular, plural, onClick }: NewItemsButtonProps) {
  if (count <= 0) return null
  return (
    <div className="sticky top-20 z-20 mb-4 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 rounded-full bg-dark-blue px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-dark-blue-light"
      >
        <ArrowUp size={16} aria-hidden="true" />
        {count === 1 ? `1 ${singular} anzeigen` : `${count} ${plural} anzeigen`}
      </button>
    </div>
  )
}
