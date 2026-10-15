import { ExternalLink } from 'lucide-react'
import Lotus from '@/components/ui/Lotus'
import type { Vendor } from '@/lib/vendors'

interface VendorsProps {
  vendors: Vendor[]
}

function kindOf(href: string): string {
  return new URL(href).hostname.endsWith('instagram.com') ? 'Instagram' : 'Website'
}

// Danke an die Dienstleister, bewusst ruhig: Name, darunter Rolle oder Art des
// Links, in einer umbrechenden Reihe. Die Links öffnen in einem neuen Tab und
// geben keinen Referer weiter.
export default function Vendors({ vendors }: VendorsProps) {
  if (vendors.length === 0) return null
  return (
    <section id="dienstleister" className="mt-14 border-t border-champagne-dark/70 pt-10 text-center">
      <Lotus size={22} className="mx-auto text-gold" />
      <h3 className="mt-3 font-display text-3xl font-semibold text-dark-blue">Unsere Dienstleister</h3>
      <p className="mt-1 text-sm text-gray-700">Danke an alle, die diesen Tag möglich machen.</p>
      <ul className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-5">
        {vendors.map((vendor) => {
          const kind = kindOf(vendor.href)
          return (
            <li key={vendor.href}>
              <a
                href={vendor.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${vendor.name} – ${kind} (öffnet in einem neuen Tab)`}
                className="group inline-flex flex-col items-center text-dark-blue"
              >
                <span className="inline-flex items-center gap-1.5 font-display text-xl font-semibold leading-tight underline decoration-gold/0 underline-offset-4 transition-colors group-hover:decoration-gold">
                  {vendor.name}
                  <ExternalLink size={13} aria-hidden="true" className="text-gray-500" />
                </span>
                <span className="text-xs text-gray-600">{vendor.role ?? kind}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
