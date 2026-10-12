import { redirect } from 'next/navigation'

// Jede unbekannte URL (z. B. ein alter Link auf die entfernte FAQ-Seite oder
// ein Tippfehler im QR-Code) führt auf die Startseite, statt eine 404-Seite
// zu zeigen. Gilt auch für nicht existierende /api-Pfade; vorhandene
// API-Routen antworten weiter selbst mit ihren JSON-Statuscodes.
export default function NotFound() {
  redirect('/')
}
