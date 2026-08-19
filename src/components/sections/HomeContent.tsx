'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Calendar, MapPin, Shirt, Clock, ArrowRight, BookOpen,
  Camera, MessageSquare, Heart, HelpCircle, Mail, Gamepad2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import { civilWedding, traditionalWedding, storyTimeline } from '@/lib/config'

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

// Small floating ornament for dividers
function HeartDivider() {
  return (
    <div className="flex items-center justify-center gap-3 my-2">
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
      <Heart size={10} className="text-gold fill-gold" />
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  )
}

export default function HomeContent() {
  return (
    <>
      {/* ── Our Story Teaser ─────────────────────────── */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.div variants={fadeInUp}>
              <SectionTitle
                title="Unsere Geschichte"
                subtitle="Von einem zufälligen Treffen zu einer großen Liebe – so begann alles."
              />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {storyTimeline.slice(0, 3).map((item, index) => (
                <motion.div key={item.id} variants={fadeInUp} custom={index}>
                  <Card hover className="h-full">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-champagne flex items-center justify-center flex-shrink-0">
                        <span className="text-dark-blue font-serif font-semibold text-xs text-center leading-tight">
                          {item.year.split(' ')[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-semibold text-dark-blue mb-1">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div variants={fadeInUp} className="text-center mt-8">
              <Link href="/story">
                <Button variant="secondary" size="md">
                  <BookOpen size={16} />
                  Vollständige Geschichte lesen
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Wedding Info Cards ────────────────────────── */}
      <section className="py-16 md:py-24 bg-champagne-light/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.div variants={fadeInUp}>
              <SectionTitle
                title="Die Hochzeiten"
                subtitle="Zwei besondere Feiern – eine Liebe. Alle wichtigen Informationen auf einen Blick."
              />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Civil Wedding Card */}
              <motion.div variants={fadeInUp}>
                <Card variant="dark" padding="lg" className="h-full group">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <Calendar size={22} className="text-champagne" />
                    </div>
                    <div>
                      <p className="text-champagne/60 text-xs font-medium uppercase tracking-wider">Standesamt</p>
                      <h3 className="font-serif text-xl font-semibold text-white">{civilWedding.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white/80">
                      <Calendar size={16} className="text-gold flex-shrink-0" />
                      <span className="text-sm">{civilWedding.displayDate}</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80">
                      <Clock size={16} className="text-gold flex-shrink-0" />
                      <span className="text-sm">{civilWedding.time}</span>
                    </div>
                    <div className="flex items-start gap-3 text-white/80">
                      <MapPin size={16} className="text-gold flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-white">{civilWedding.venue}</p>
                        <p className="text-xs text-white/60">{civilWedding.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-white/80">
                      <Shirt size={16} className="text-gold flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{civilWedding.dresscode}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Link href="/info" className="flex-1">
                      <Button variant="gold" size="sm" className="w-full">
                        Alle Infos
                        <ArrowRight size={14} />
                      </Button>
                    </Link>
                    <Link href="/einladungen">
                      <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 border border-white/20">
                        <Mail size={14} />
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>

              {/* Traditional Wedding Card */}
              <motion.div variants={fadeInUp}>
                <Card variant="champagne" padding="lg" className="h-full border-2 border-champagne-dark/30 group">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 bg-dark-blue/10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <Heart size={22} className="text-dark-blue" />
                    </div>
                    <div>
                      <p className="text-dark-blue/50 text-xs font-medium uppercase tracking-wider">Tamilische Hochzeit</p>
                      <h3 className="font-serif text-xl font-semibold text-dark-blue">{traditionalWedding.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-dark-blue/70">
                      <Calendar size={16} className="text-dark-blue flex-shrink-0" />
                      <span className="text-sm font-medium">{traditionalWedding.displayDate}</span>
                    </div>
                    <div className="flex items-center gap-3 text-dark-blue/70">
                      <Clock size={16} className="text-dark-blue flex-shrink-0" />
                      <span className="text-sm">Datum wird noch bekanntgegeben</span>
                    </div>
                    <div className="flex items-start gap-3 text-dark-blue/70">
                      <MapPin size={16} className="text-dark-blue flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-dark-blue">{traditionalWedding.venue}</p>
                        <p className="text-xs text-dark-blue/50">{traditionalWedding.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-dark-blue/70">
                      <Shirt size={16} className="text-dark-blue flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{traditionalWedding.dresscode}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Link href="/info#traditional">
                      <Button variant="primary" size="sm" className="w-full">
                        Alle Infos
                        <ArrowRight size={14} />
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Invitation Teaser ─────────────────────────── */}
      <section className="py-16 md:py-20 bg-white relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-champagne-light blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-baby-blue-light blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.div variants={fadeInUp} className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-champagne rounded-2xl flex items-center justify-center">
                <Mail size={24} className="text-dark-blue" />
              </div>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <HeartDivider />
            </motion.div>

            <motion.h2 variants={fadeInUp} className="font-serif text-3xl md:text-4xl font-semibold text-dark-blue mt-4 mb-3">
              Unsere Einladungen
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-gray-500 max-w-md mx-auto mb-8 text-sm md:text-base">
              Schau dir unsere Einladungskarten für die standesamtliche Trauung und die Empfangsfeier an.
              Tippe einfach drauf, um sie zu öffnen.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/einladungen">
                <Button variant="primary" size="lg">
                  <Mail size={16} />
                  Einladungen ansehen
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────── */}
      <section className="py-16 md:py-24 bg-champagne-light/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.div variants={fadeInUp}>
              <SectionTitle
                title="Entdeckt unsere Website"
                subtitle="Alles, was ihr für unsere Hochzeit wissen müsst – und noch mehr."
              />
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: HelpCircle,
                  title: 'FAQ',
                  description: 'Antworten auf die häufigsten Fragen rund um die Hochzeit.',
                  href: '/faq',
                  color: 'bg-baby-blue/20',
                  iconColor: 'text-dark-blue',
                },
                {
                  icon: Camera,
                  title: 'Galerie',
                  description: 'Fotos aus unserem gemeinsamen Leben – vom ersten Treffen bis zur Verlobung.',
                  href: '/gallery',
                  color: 'bg-champagne/50',
                  iconColor: 'text-dark-blue',
                },
                {
                  icon: MessageSquare,
                  title: 'Gästebuch',
                  description: 'Hinterlasst uns eine Nachricht und seid Teil unserer Geschichte.',
                  href: '/guestbook',
                  color: 'bg-gold/10',
                  iconColor: 'text-gold-dark',
                },
                {
                  icon: BookOpen,
                  title: 'Quiz',
                  description: 'Wie gut kennt ihr uns? Testet euer Wissen in unserem Hochzeitsquiz!',
                  href: '/quiz',
                  color: 'bg-dark-blue/5',
                  iconColor: 'text-dark-blue',
                },
                {
                  icon: Gamepad2,
                  title: 'Gästespiel',
                  description: 'Spielt unser Liebes-Memory und findet alle Pärchen – mit Bestzeit!',
                  href: '/memory-spiel',
                  color: 'bg-baby-blue/20',
                  iconColor: 'text-dark-blue',
                },
              ].map((feature, index) => (
                <motion.div key={feature.title} variants={fadeInUp} custom={index}>
                  <Link href={feature.href} className="block h-full">
                    <Card hover className="h-full group">
                      <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                        <feature.icon size={22} className={feature.iconColor} />
                      </div>
                      <h3 className="font-serif text-lg font-semibold text-dark-blue mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed mb-4">
                        {feature.description}
                      </p>
                      <div className="flex items-center gap-1 text-dark-blue text-sm font-medium mt-auto">
                        <span>Mehr erfahren</span>
                        <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────── */}
      <section className="py-16 md:py-24 bg-dark-blue relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/3" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02]" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            <motion.div variants={fadeInUp} className="flex justify-center mb-5">
              <Heart size={32} className="text-gold fill-gold" />
            </motion.div>
            <motion.h2 variants={fadeInUp} className="font-serif text-3xl md:text-5xl font-semibold text-white mb-5">
              Wir können es kaum erwarten!
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-white/70 text-base md:text-lg leading-relaxed mb-8">
              Freut euch mit uns auf diesen besonderen Tag. Meldet euch an, teilt eure
              Erinnerungen und seid Teil unserer Geschichte.
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contact">
                <Button variant="gold" size="lg">
                  Anmelden / Kontakt
                  <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/memories">
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-white hover:bg-white/10 border border-white/20"
                >
                  Erinnerung teilen
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
