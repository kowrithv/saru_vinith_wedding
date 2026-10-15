import { Calendar, Info as InfoIcon } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
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

        <Card variant="dark" padding="lg" className="mb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calendar size={26} className="text-champagne" />
            </div>
            <div>
              <p className="text-champagne/60 text-xs font-medium uppercase tracking-wider">
                <span>{receptionEvent.displayDate}</span>
                <span aria-hidden="true"> · </span>
                <span>{receptionEvent.time}</span>
              </p>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-white">
                {receptionEvent.title}
              </h2>
              <p className="text-white/70 text-sm mt-1">{receptionEvent.description}</p>
            </div>
          </div>
        </Card>

        <div className="mb-8">
          <VenueMap
            lat={receptionEvent.lat}
            lng={receptionEvent.lng}
            label={receptionEvent.venue}
            address={receptionEvent.address}
            parking={receptionEvent.parking}
          />
        </div>

        <GoodToKnow items={goodToKnow} />

        <Card variant="ornate" padding="lg">
          <h3 className="font-serif text-xl font-semibold text-dark-blue mb-5 flex items-center gap-2">
            <InfoIcon size={18} className="text-gold" />
            Ablauf des Tages
          </h3>
          <ProgramTimeline schedule={receptionSchedule} />
        </Card>

        <Vendors vendors={vendors} />
      </div>
    </div>
  )
}
