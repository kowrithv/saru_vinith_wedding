import { KeyRound } from 'lucide-react'
import { textFieldClassName } from '@/lib/form-styles'

interface GuestPasswordFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Der QR-Link trug ein Kennwort, das nicht (mehr) gilt. */
  linkRejected?: boolean
}

// Das eine Kennwort für Gästebuch, Erinnerungen und Galerie. Es steht im
// Klartext, weil es kurz ist, am Empfang aushängt und am Handy sonst oft
// verschrieben wird; Auto-Großschreibung und -Korrektur sind aus.
export default function GuestPasswordField({ id, value, onChange, linkRejected = false }: GuestPasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        <KeyRound size={14} className="inline mr-1" />
        Kennwort vom Empfang
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Kennwort"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={textFieldClassName}
      />
      <p className="mt-1.5 text-xs text-gray-500">
        {linkRejected
          ? 'Der QR-Code ist nicht mehr gültig. Bitte gib das Kennwort ein oder scanne den neuen QR-Code am Empfang.'
          : 'Einfacher: den QR-Code am Empfang scannen.'}
      </p>
    </div>
  )
}
