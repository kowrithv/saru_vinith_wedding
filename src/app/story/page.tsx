'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Heart,
  MessageCircle,
  Users,
  Flower2,
  Gem,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Lotus from '@/components/ui/Lotus'
import { cn } from '@/lib/utils'
import { storyTimeline, type TimelineIcon } from '@/lib/story-content'

const iconMap: Record<TimelineIcon, LucideIcon> = {
  heart: Heart,
  message: MessageCircle,
  family: Users,
  flower: Flower2,
  ring: Gem,
  certificate: FileText,
}

// Lange Absätze sind auf dem Handy eine Wand: erst vier Zeilen, der Rest auf Wunsch.
function StoryText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <p className={cn('text-gray-600 leading-relaxed text-sm md:text-base', !open && 'line-clamp-4')}>{text}</p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-2 text-sm font-semibold text-bordeaux underline-offset-4 hover:underline"
      >
        {open ? 'Weniger anzeigen' : 'Weiterlesen'}
      </button>
    </>
  )
}

/** "15.11.2023" -> "2023" (die Jahreszahl als Blickfang); sonst der ganze Text. */
function yearOf(date: string): string {
  return /\d{4}$/.exec(date)?.[0] ?? date
}

export default function StoryPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Unsere Geschichte"
          subtitle="Jede große Liebe beginnt mit einer kleinen Geschichte. Dies ist unsere."
        />

        <div className="relative mt-12">
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-champagne-dark via-gold/30 to-champagne-dark" />

          <div className="space-y-6 md:space-y-0">
            {storyTimeline.map((item) => {
              const IconComponent = iconMap[item.icon]
              const isLeft = item.align === 'left'

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5 }}
                  className={`relative md:flex md:items-center ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} md:gap-8 mb-6 md:mb-12`}
                >
                  <div className={`md:w-[calc(50%-3rem)] ${isLeft ? 'md:text-right' : 'md:text-left'}`}>
                    <Card
                      variant="ornate"
                      padding="none"
                      className={`p-6 md:p-8 ${isLeft ? 'md:ml-auto' : 'md:mr-auto'}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div className={isLeft ? 'md:ml-auto md:text-right' : 'text-left'}>
                          <p className="font-display text-6xl font-semibold leading-none lining-nums text-gold-text">
                            {yearOf(item.year)}
                          </p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-bordeaux">
                            {item.year}
                          </p>
                        </div>
                        {/* Auf dem Handy gibt es keine Mittellinie: die Markierung
                            sitzt in der Kopfzeile der Karte statt als lose Zeile
                            darunter. */}
                        <span
                          data-testid="story-marker"
                          aria-hidden="true"
                          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-champagne-dark bg-white text-dark-blue md:hidden"
                        >
                          <IconComponent size={18} />
                        </span>
                      </div>
                      {item.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo}
                          alt={item.title}
                          loading="lazy"
                          className="mb-4 h-48 w-full rounded-t-3xl rounded-b-md object-cover"
                        />
                      )}
                      <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight text-dark-blue mb-3">
                        {item.title}
                      </h3>
                      <StoryText text={item.description} />
                    </Card>
                  </div>

                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-14 h-14 bg-white border-4 border-champagne rounded-full items-center justify-center shadow-md z-10">
                    <IconComponent size={20} className="text-dark-blue" />
                  </div>

                  <div className="hidden md:block md:w-[calc(50%-3rem)]" />
                </motion.div>
              )
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mt-16"
        >
          <Card variant="ornate" padding="lg" className="mx-auto flex max-w-lg flex-col items-center">
            <Lotus size={36} className="text-bordeaux" />
            <p className="mt-3 font-display text-3xl font-semibold text-dark-blue">Das Beste kommt noch</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Unsere Geschichte ist noch nicht zu Ende – sie fängt gerade erst an.
              Wir freuen uns darauf, sie gemeinsam mit euch zu schreiben.
            </p>
            <Link
              href="/memories"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-bordeaux px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-bordeaux-light"
            >
              Erinnerung teilen
            </Link>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
