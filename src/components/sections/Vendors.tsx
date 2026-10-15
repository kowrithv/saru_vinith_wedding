import { ExternalLink, HeartHandshake } from 'lucide-react'
import Card from '@/components/ui/Card'
import type { Vendor } from '@/lib/vendors'

interface VendorsProps {
  vendors: Vendor[]
}

function kindOf(href: string): string {
  return new URL(href).hostname.endsWith('instagram.com') ? 'Instagram' : 'Website'
}

// Danke an die Dienstleister: Name, ggf. Rolle und ein Link zu ihrem Profil.
// Die Links öffnen in einem neuen Tab und geben keinen Referer weiter.
export default function Vendors({ vendors }: VendorsProps) {
  if (vendors.length === 0) return null
  return (
    <section id="dienstleister" className="mt-8">
      <Card variant="ornate" padding="lg">
        <h3 className="mb-2 flex items-center gap-2 font-serif text-xl font-semibold text-dark-blue">
          <HeartHandshake size={18} className="text-gold" />
          Unsere Dienstleister
        </h3>
        <p className="mb-5 text-sm text-gray-700">Danke an alle, die diesen Tag möglich machen.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {vendors.map((vendor) => {
            const kind = kindOf(vendor.href)
            return (
              <li key={vendor.href}>
                <a
                  href={vendor.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${vendor.name} – ${kind} (öffnet in einem neuen Tab)`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-champagne-dark bg-white px-4 py-3 transition-colors hover:border-gold"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-xl font-semibold leading-tight text-dark-blue">
                      {vendor.name}
                    </span>
                    <span className="block text-xs text-gray-600">{vendor.role ?? kind}</span>
                  </span>
                  <ExternalLink
                    size={16}
                    aria-hidden="true"
                    className="flex-shrink-0 text-gray-500 transition-colors group-hover:text-dark-blue"
                  />
                </a>
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}
