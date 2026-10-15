import { Calendar, Clock, MapPin, Car, Info as InfoIcon, type LucideIcon } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import VenueMap from '@/components/sections/VenueMap'
import ProgramTimeline from '@/components/sections/ProgramTimeline'
import SaveToCalendarButton from '@/components/sections/SaveToCalendarButton'
import GoodToKnow from '@/components/sections/GoodToKnow'
import { goodToKnow, receptionEvent, receptionSchedule } from '@/lib/event-info'

interface InfoCardProps {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
}

function InfoCard({ icon: Icon, label, value, sublabel }: InfoCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="w-10 h-10 bg-champagne rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-dark-blue" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-semibold text-dark-blue">{value}</p>
        {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}

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
                {receptionEvent.displayDate}
              </p>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-white">
                {receptionEvent.title}
              </h2>
              <p className="text-white/70 text-sm mt-1">{receptionEvent.description}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <InfoCard icon={Calendar} label="Datum" value={receptionEvent.displayDate} />
          <InfoCard icon={Clock} label="Uhrzeit" value={receptionEvent.time} />
          <InfoCard icon={MapPin} label="Ort" value={receptionEvent.venue} sublabel={receptionEvent.address} />
          <InfoCard icon={Car} label="Parken" value="Parkplätze direkt an der Begegnungsstätte" />
        </div>

        <div className="mb-4 flex justify-center">
          <SaveToCalendarButton />
        </div>

        <div className="mb-8">
          <VenueMap
            lat={receptionEvent.lat}
            lng={receptionEvent.lng}
            label={receptionEvent.venue}
            address={receptionEvent.address}
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
      </div>
    </div>
  )
}
