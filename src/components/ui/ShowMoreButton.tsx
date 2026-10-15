interface ShowMoreButtonProps {
  /** Beschriftung, z. B. "70 weitere Fotos anzeigen". */
  label: string
  onClick: () => void
}

// Lange Listen werden stückweise gezeigt (Galerie, Gästebuch, Erinnerungen):
// am Fest kommen Hunderte Einträge und Tausende Fotos zusammen.
export default function ShowMoreButton({ label, onClick }: ShowMoreButtonProps) {
  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border-2 border-dark-blue px-6 py-2.5 text-sm font-medium text-dark-blue transition-colors hover:bg-dark-blue hover:text-white"
      >
        {label}
      </button>
    </div>
  )
}
