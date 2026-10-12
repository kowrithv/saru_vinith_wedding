import Link from 'next/link'
import RedirectHome from '@/components/layout/RedirectHome'

// Jede unbekannte URL (z. B. ein alter Link auf die entfernte FAQ-Seite oder
// ein Tippfehler im QR-Code) führt auf die Startseite. Bewusst kein
// redirect() aus next/navigation: der Produktions-Build rendert diese Seite
// vor und liefert sie mit Status 404 aus - ein dort geworfenes redirect()
// ergäbe eine leere Seite statt einer Weiterleitung. Stattdessen:
// 1. RedirectHome ersetzt die URL per Router (mit JavaScript, sofort),
// 2. das Meta-Refresh greift ohne JavaScript,
// 3. der sichtbare Link bleibt, falls beides blockiert ist.
// Status 404 bleibt erhalten (Suchmaschinen, API-Clients, Monitoring).
export default function NotFound() {
  return (
    <div className="pt-24 pb-16">
      <meta httpEquiv="refresh" content="0;url=/" />
      <RedirectHome />
      <div className="max-w-md mx-auto px-4 sm:px-6 text-center">
        <p className="text-gray-600 mb-4">Diese Seite gibt es nicht – du wirst zur Startseite weitergeleitet.</p>
        <Link href="/" className="text-dark-blue font-medium underline underline-offset-4">
          Zur Startseite
        </Link>
      </div>
    </div>
  )
}
