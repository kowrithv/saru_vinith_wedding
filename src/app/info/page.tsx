import { Clock } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Lotus from '@/components/ui/Lotus'
import VenueMap from '@/components/sections/VenueMap'
import ProgramTimeline from '@/components/sections/ProgramTimeline'
import GoodToKnow from '@/components/sections/GoodToKnow'
import Vendors from '@/components/sections/Vendors'
import { vendors } from '@/lib/vendors'
import { goodToKnow, receptionEvent, receptionSchedule } from '@/lib/event-info'

export default function InfoPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Hochzeitsinfos"
          subtitle="Alles was ihr wissen müsst – von Uhrzeit bis Parkplätze."
        />

        {/* Der Tag auf einen Blick: Wochentag und Datum groß, darunter Anlass,
            Uhrzeit und Ort. Route und Kalender stehen bei der Anfahrt. */}
        <Card variant="dark" padding="lg" className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Samstag</p>
          <p className="mt-2 font-display text-4xl font-semibold leading-none sm:text-5xl md:text-6xl">
            {receptionEvent.displayDate}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 text-gold" aria-hidden="true">
            <span className="h-px w-14 bg-gold/50" />
            <Lotus size={18} />
            <span className="h-px w-14 bg-gold/50" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold">{receptionEvent.title}</h2>
          <p className="mt-1 text-champagne-light/90">
            <span>ab </span>
            <span>{receptionEvent.time}</span>
            <span aria-hidden="true"> · </span>
            <span>{receptionEvent.venue}</span>
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/75">{receptionEvent.description}</p>
        </Card>

        {/* Ablauf links, Anfahrt rechts; auf dem Handy untereinander. */}
        <div data-testid="info-columns" className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card variant="ornate" padding="lg">
            <h3 className="mb-6 flex items-center gap-2 font-serif text-xl font-semibold text-dark-blue">
              <Clock size={18} className="text-gold" />
              Ablauf des Tages
            </h3>
            <ProgramTimeline schedule={receptionSchedule} />
          </Card>

          <div>
            <VenueMap
              lat={receptionEvent.lat}
              lng={receptionEvent.lng}
              label={receptionEvent.venue}
              address={receptionEvent.address}
              parking={receptionEvent.parking}
            />
          </div>
        </div>

        <div className="mt-8">
          <GoodToKnow items={goodToKnow} />
        </div>

        <Vendors vendors={vendors} />
      </div>
    </div>
  )
}
