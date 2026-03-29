'use client'

import { motion } from 'framer-motion'
import { Heart, Plane, Gem, FileText, Stars } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import { storyTimeline } from '@/lib/config'

import type { LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  heart: Heart,
  plane: Plane,
  ring: Gem,
  certificate: FileText,
  celebration: Stars,
}

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

export default function StoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-champagne-light/30 to-white pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeInUp}>
            <SectionTitle
              title="Unsere Geschichte"
              subtitle="Jede große Liebe beginnt mit einer kleinen Geschichte. Dies ist unsere."
            />
          </motion.div>

          {/* Timeline */}
          <div className="relative mt-12">
            {/* Center line - visible on md+ */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-champagne-dark via-gold/30 to-champagne-dark" />

            <div className="space-y-12 md:space-y-0">
              {storyTimeline.map((item) => {
                const IconComponent = iconMap[item.icon] || Heart
                const isLeft = item.align === 'left'

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className={`relative md:flex md:items-center ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} md:gap-8 mb-12`}
                  >
                    {/* Content */}
                    <div className={`md:w-[calc(50%-3rem)] ${isLeft ? 'md:text-right' : 'md:text-left'}`}>
                      <div
                        className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 ${
                          isLeft ? 'md:ml-auto' : 'md:mr-auto'
                        }`}
                      >
                        {/* Year badge */}
                        <div className={`flex items-center gap-2 mb-3 ${isLeft ? 'md:justify-end' : 'justify-start'}`}>
                          <span className="inline-block px-3 py-1 bg-champagne text-dark-blue text-xs font-semibold rounded-full uppercase tracking-wider">
                            {item.year}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-serif text-xl md:text-2xl font-semibold text-dark-blue mb-3">
                          {item.title}
                        </h3>

                        {/* Description */}
                        <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Center icon */}
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-14 h-14 bg-white border-4 border-champagne rounded-full items-center justify-center shadow-md z-10">
                      <IconComponent size={20} className="text-dark-blue" />
                    </div>

                    {/* Mobile icon */}
                    <div className="md:hidden flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-champagne rounded-full flex items-center justify-center flex-shrink-0">
                        <IconComponent size={18} className="text-dark-blue" />
                      </div>
                      <div className="h-px flex-1 bg-champagne-dark/40" />
                    </div>

                    {/* Spacer for the other side */}
                    <div className="hidden md:block md:w-[calc(50%-3rem)]" />
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Bottom message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mt-16"
          >
            <div className="inline-block bg-dark-blue text-white rounded-2xl px-8 py-8 max-w-lg mx-auto">
              <Heart size={28} className="text-gold fill-gold mx-auto mb-4" />
              <p className="font-serif text-xl font-semibold mb-3">
                Das Beste kommt noch
              </p>
              <p className="text-white/70 text-sm leading-relaxed">
                Unsere Geschichte ist noch nicht zu Ende – sie fängt gerade erst an.
                Wir freuen uns darauf, sie gemeinsam mit euch zu schreiben.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
