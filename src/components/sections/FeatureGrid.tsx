import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import { homeFeatures } from '@/lib/home-content'

export default function FeatureGrid() {
  return (
    <section className="py-16 md:py-24 bg-champagne-light/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Entdeckt unsere Website"
          subtitle="Alles, was ihr für unsere Hochzeit wissen müsst – und noch mehr."
        />

        {/* Unterhalb von sm sind die Kacheln kompakte Zeilen (Icon, Titel,
            Aktion; ohne Beschreibung) - sieben große Kacheln wären auf dem
            Handy fast drei Bildschirme lang. Bei drei Spalten steht eine
            einzelne letzte Kachel mittig statt links. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:[&>:last-child:nth-child(3n+1)]:col-start-2 gap-3 sm:gap-5">
          {homeFeatures.map((feature) => (
            <Link key={feature.title} href={feature.href} className="block h-full">
              <Card hover padding="none" className="h-full group flex items-center gap-4 p-4 sm:block sm:p-6">
                <div className="w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 bg-champagne/50 rounded-xl flex items-center justify-center sm:mb-4 transition-transform duration-300 group-hover:scale-110">
                  <feature.icon size={22} className="text-dark-blue" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-semibold text-dark-blue sm:mb-2">{feature.title}</h3>
                  <p className="hidden sm:block text-sm text-gray-500 leading-relaxed mb-4">{feature.description}</p>
                  <div className="flex items-center gap-1 text-dark-blue text-sm font-medium">
                    <span>{feature.cta}</span>
                    <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
