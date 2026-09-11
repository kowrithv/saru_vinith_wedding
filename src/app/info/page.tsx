'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Clock,
  MapPin,
  Car,
  Hotel,
  Info,
  Heart,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import VenueMap from '@/components/sections/VenueMap'
import { receptionEvent, traditionalWedding, showTraditionalWeddingTab } from '@/lib/config'

type TabId = 'reception' | 'traditional'

interface InfoItem {
  icon: LucideIcon
  label: string
  value: string | string[]
  sublabel?: string
}

const receptionSchedule = [
  { time: '16:30 Uhr', event: 'Einlass & Empfang der Gäste' },
  { time: 'TBA', event: 'Sektempfang & Gratulationen' },
  { time: 'TBA', event: 'Gemeinsames Abendessen' },
  { time: 'TBA', event: 'Party & Tanz' },
]

const traditionalSchedule = [
  { time: 'TBA', event: 'Einlass & Begrüßung' },
  { time: 'TBA', event: 'Tamilische Willkommenszeremonie' },
  { time: 'TBA', event: 'Hauptzeremonie (Thaali-Anlegen)' },
  { time: 'TBA', event: 'Festliches Mittagessen' },
  { time: 'TBA', event: 'Musik, Tanz & Feier' },
]

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

function InfoCard({ icon: Icon, label, value, sublabel }: InfoItem) {
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="w-10 h-10 bg-champagne rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-dark-blue" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {Array.isArray(value) ? (
          <ul className="space-y-0.5">
            {value.map((v, i) => (
              <li key={i} className="text-sm text-dark-blue font-medium">{v}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-dark-blue">{value}</p>
        )}
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}

export default function InfoPage() {
  const [activeTab, setActiveTab] = useState<TabId>('reception')

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-champagne-light/20 pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeInUp}>
            <SectionTitle
              title="Hochzeitsinfos"
              subtitle="Alles was ihr wissen müsst – von Uhrzeit bis Parkplätze."
            />
          </motion.div>

          {/* Tab buttons */}
          {showTraditionalWeddingTab && (
            <motion.div variants={fadeInUp} className="flex justify-center mb-10">
              <div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">
                <button
                  onClick={() => setActiveTab('reception')}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'reception'
                      ? 'bg-dark-blue text-white shadow-sm'
                      : 'text-gray-600 hover:text-dark-blue'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar size={15} />
                    Empfang
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('traditional')}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'traditional'
                      ? 'bg-dark-blue text-white shadow-sm'
                      : 'text-gray-600 hover:text-dark-blue'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Heart size={15} />
                    Tamilische Hochzeit
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {!showTraditionalWeddingTab || activeTab === 'reception' ? (
              <motion.div
                key="reception"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* Hero card */}
                <Card variant="dark" padding="lg" className="mb-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Calendar size={26} className="text-champagne" />
                    </div>
                    <div>
                      <p className="text-champagne/60 text-xs font-medium uppercase tracking-wider">17. Oktober 2026</p>
                      <h2 className="font-serif text-2xl md:text-3xl font-semibold text-white">{receptionEvent.title}</h2>
                      <p className="text-white/70 text-sm mt-1">{receptionEvent.description}</p>
                    </div>
                  </div>
                </Card>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <InfoCard icon={Calendar} label="Datum" value={receptionEvent.displayDate} />
                  <InfoCard icon={Clock} label="Uhrzeit" value={receptionEvent.time} />
                  <InfoCard
                    icon={MapPin}
                    label="Ort"
                    value={receptionEvent.venue}
                    sublabel={receptionEvent.address}
                  />
                  <InfoCard
                    icon={Car}
                    label="Parken"
                    value="Parkplätze direkt an der Begegnungsstätte"
                  />
                </div>

                {/* Map */}
                {receptionEvent.lat && receptionEvent.lng && (
                  <div className="mb-8">
                    <VenueMap
                      lat={receptionEvent.lat}
                      lng={receptionEvent.lng}
                      label={receptionEvent.venue}
                      address={receptionEvent.address}
                    />
                  </div>
                )}

                {/* Schedule */}
                <Card padding="lg">
                  <h3 className="font-serif text-xl font-semibold text-dark-blue mb-5 flex items-center gap-2">
                    <Info size={18} className="text-gold" />
                    Ablauf des Tages
                  </h3>
                  <div className="space-y-4">
                    {receptionSchedule.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-4"
                      >
                        <div className="flex-shrink-0 w-24 text-right">
                          <span className="text-xs font-semibold text-gold bg-champagne px-2 py-1 rounded-full">
                            {item.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-2 h-2 bg-dark-blue rounded-full flex-shrink-0" />
                          <p className="text-sm text-gray-700">{item.event}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="traditional"
                id="traditional"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* Hero card */}
                <div className="bg-gradient-to-r from-champagne to-baby-blue-light rounded-2xl p-6 md:p-8 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-dark-blue/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Heart size={26} className="text-dark-blue" />
                    </div>
                    <div>
                      <p className="text-dark-blue/50 text-xs font-medium uppercase tracking-wider">2027 – Datum folgt</p>
                      <h2 className="font-serif text-2xl md:text-3xl font-semibold text-dark-blue">{traditionalWedding.title}</h2>
                      <p className="text-dark-blue/70 text-sm mt-1">{traditionalWedding.description}</p>
                    </div>
                  </div>
                </div>

                {/* Coming soon notice */}
                <Card variant="champagne" padding="md" className="mb-6 border-2 border-gold/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-gold flex-shrink-0" />
                    <p className="text-sm text-dark-blue">
                      <strong>Datum wird noch bekanntgegeben.</strong> Ihr erhaltet rechtzeitig eine persönliche Einladung mit allen Details.
                    </p>
                  </div>
                </Card>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <InfoCard icon={Calendar} label="Datum" value="2027 – Wird noch bekanntgegeben" />
                  <InfoCard icon={Clock} label="Uhrzeit" value="Wird noch bekanntgegeben" />
                  <InfoCard
                    icon={MapPin}
                    label="Ort (vorläufig)"
                    value={traditionalWedding.venue}
                    sublabel={traditionalWedding.address}
                  />
                  <InfoCard
                    icon={Car}
                    label="Parken"
                    value="Infos folgen mit der Einladung"
                  />
                  <InfoCard
                    icon={Hotel}
                    label="Unterkunft"
                    value="Empfehlungen folgen mit der Einladung"
                  />
                </div>

                {/* What to expect */}
                <Card padding="lg">
                  <h3 className="font-serif text-xl font-semibold text-dark-blue mb-5 flex items-center gap-2">
                    <Heart size={18} className="text-gold" />
                    Was euch erwartet
                  </h3>
                  <div className="space-y-3">
                    {[
                      'Farbenfrohe tamilische Zeremonien und Rituale',
                      'Traditionelle Thaali-Zeremonie (Anlegen der Heiratskette)',
                      'Live-Musik und Bharatanatyam-Tanz',
                      'Authentisches tamilisches Festessen',
                      'Festliche Atmosphäre mit Familie aus aller Welt',
                      'Fotomöglichkeiten in traditionellen Kleidern',
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-champagne flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 bg-gold rounded-full" />
                        </div>
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Tentative schedule */}
                <Card padding="lg" className="mt-6">
                  <h3 className="font-serif text-xl font-semibold text-dark-blue mb-5 flex items-center gap-2">
                    <Clock size={18} className="text-gold" />
                    Vorläufiger Ablauf
                  </h3>
                  <div className="space-y-4">
                    {traditionalSchedule.map((item, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-20 text-right">
                          <span className="text-xs font-semibold text-gray-400">{item.time}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-2 h-2 bg-champagne-dark rounded-full flex-shrink-0" />
                          <p className="text-sm text-gray-700">{item.event}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-4 italic">
                    * Der genaue Ablauf wird mit der Einladung bekannt gegeben.
                  </p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
