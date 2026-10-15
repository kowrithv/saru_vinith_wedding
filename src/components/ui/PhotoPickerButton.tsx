import type { ChangeEvent } from 'react'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhotoPickerButtonProps {
  id: string
  /** Die Beschriftung auf dem Knopf, z. B. "Fotos auswählen". */
  label: string
  /** Kleine Zeile darunter, z. B. "mehrere möglich". */
  hint?: string
  multiple?: boolean
  disabled?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  className?: string
}

// Das Standard-Dateifeld des Browsers ("Datei auswählen – Keine ausgewählt") ist
// klein, grau und auf dem Handy leicht zu übersehen. Hier ist das Feld
// unsichtbar (aber echt: Tastatur, Screenreader und Tests bedienen es wie
// gewohnt), und sein Label ist ein großer Knopf. Die Fokus- und
// Deaktiviert-Zustände kommen über `peer` vom Feld.
export default function PhotoPickerButton({
  id,
  label,
  hint,
  multiple = false,
  disabled = false,
  onChange,
  className,
}: PhotoPickerButtonProps) {
  return (
    <div className={className}>
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl',
          'border-2 border-dashed border-dark-blue/50 bg-champagne-light px-4 py-5 text-center',
          'transition-colors hover:border-dark-blue hover:bg-champagne active:scale-[0.99]',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dark-blue',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-disabled:hover:border-dark-blue/50 peer-disabled:hover:bg-champagne-light'
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bordeaux text-white shadow-sm">
          <Camera size={24} aria-hidden="true" />
        </span>
        <span className="font-serif text-lg font-semibold text-dark-blue">{label}</span>
        {hint && <span className="text-xs text-gray-600">{hint}</span>}
      </label>
    </div>
  )
}
