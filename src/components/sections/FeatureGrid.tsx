import Link from 'next/link'
import SectionTitle from '@/components/ui/SectionTitle'
import Lotus from '@/components/ui/Lotus'
import { homeFeatures } from '@/lib/home-content'
import { homePreviewPhotos } from '@/lib/site-images'
import { cn } from '@/lib/utils'

export default function FeatureGrid() {
  const large = homeFeatures.filter((feature) => feature.featured)
  const compact = homeFeatures.filter((feature) => !feature.featured)

  return (
    <section className="py-16 md:py-24 bg-rose-sand-light">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Entdeckt unsere Website"
          subtitle="Alles, was ihr für unsere Hochzeit wissen müsst – und noch mehr."
        />

        {/* Zwei große Kacheln für das, was Gäste zuerst suchen, darunter
            kompakte Kacheln in zwei Spalten (ab sm drei, ab lg fünf). Bleibt
            auf dem Handy eine einzelne Kachel übrig, geht sie über die ganze
            Breite. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 mb-3 sm:mb-5">
          {large.map((feature) => {
            const navy = feature.featured === 'navy'
            return (
              <Link key={feature.href} href={feature.href} className="group block h-full">
                <div
                  className={cn(
                    'relative h-full overflow-hidden rounded-2xl p-5 sm:p-6 shadow-sm transition-shadow group-hover:shadow-md',
                    navy ? 'bg-dark-blue text-white' : 'bg-champagne text-dark-blue'
                  )}
                >
                  {feature.eyebrow && (
                    <p
                      className={cn(
                        'text-xs font-semibold uppercase tracking-[0.2em]',
                        navy ? 'text-gold' : 'text-bordeaux'
                      )}
                    >
                      {feature.eyebrow}
                    </p>
                  )}
                  <h3 className="mt-1 font-display text-3xl font-semibold leading-tight">{feature.title}</h3>
                  <p className={cn('mt-2 text-sm leading-relaxed', navy ? 'text-white/80' : 'text-dark-blue/80')}>
                    {feature.description}
                  </p>
                  {navy ? (
                    <Lotus size={52} className="absolute bottom-3 right-3 text-gold opacity-55" />
                  ) : (
                    <div data-testid="gallery-previews" aria-hidden="true" className="mt-4 flex gap-2">
                      {homePreviewPhotos.map((src) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={src}
                          src={src}
                          alt=""
                          width={48}
                          height={48}
                          loading="lazy"
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <div
          data-testid="feature-grid-small"
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5"
        >
          {compact.map((feature, index) => {
            const spansRow = compact.length % 2 === 1 && index === compact.length - 1
            return (
              <Link
                key={feature.href}
                href={feature.href}
                className={cn('group block h-full', spansRow && 'col-span-2 sm:col-span-1')}
              >
                <div
                  className={cn(
                    'h-full rounded-2xl border border-champagne-dark bg-white p-3 sm:p-4 shadow-sm transition-shadow group-hover:shadow-md',
                    'flex gap-3',
                    spansRow ? 'flex-row items-center sm:flex-col sm:items-start' : 'flex-col'
                  )}
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-t-full rounded-b-lg bg-bordeaux text-white">
                    <feature.icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-serif text-base font-semibold text-dark-blue">{feature.title}</h3>
                    <p className="hidden sm:block mt-1 text-sm leading-relaxed text-gray-600">{feature.description}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
