'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, HelpCircle } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import { faqItems } from '@/lib/config'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

interface AccordionItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
  index: number
}

function AccordionItem({ question, answer, isOpen, onToggle, index }: AccordionItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isOpen
          ? 'border-dark-blue/20 bg-dark-blue/[0.02] shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 group"
        aria-expanded={isOpen}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-200 ${
              isOpen ? 'bg-dark-blue' : 'bg-champagne group-hover:bg-champagne-dark'
            }`}
          >
            <span className={`text-xs font-semibold ${isOpen ? 'text-white' : 'text-dark-blue'}`}>
              {index + 1}
            </span>
          </div>
          <span
            className={`font-medium text-sm md:text-base leading-snug transition-colors duration-200 ${
              isOpen ? 'text-dark-blue' : 'text-gray-800 group-hover:text-dark-blue'
            }`}
          >
            {question}
          </span>
        </div>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200 ${
            isOpen ? 'bg-dark-blue rotate-0' : 'bg-gray-100 group-hover:bg-champagne'
          }`}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="minus"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.15 }}
              >
                <Minus size={14} className="text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="plus"
                initial={{ opacity: 0, rotate: 90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -90 }}
                transition={{ duration: 0.15 }}
              >
                <Plus size={14} className="text-gray-600" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            <div className="px-6 pb-5">
              <div className="pl-11">
                <div className="h-px bg-gray-100 mb-4" />
                <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                  {answer}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id || null)

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-champagne-light/20 pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeInUp}>
            <SectionTitle
              title="Häufige Fragen"
              subtitle="Hier findet ihr Antworten auf die wichtigsten Fragen rund um unsere Hochzeit."
            />
          </motion.div>

          {/* FAQ header note */}
          <motion.div variants={fadeInUp} className="flex items-center gap-3 bg-champagne/40 rounded-2xl p-4 mb-8 border border-champagne-dark/20">
            <HelpCircle size={20} className="text-dark-blue flex-shrink-0" />
            <p className="text-sm text-dark-blue">
              Noch weitere Fragen? Schreibt uns über das{' '}
              <a href="/contact" className="font-semibold underline underline-offset-2">
                Kontaktformular
              </a>
              , wir antworten gerne!
            </p>
          </motion.div>

          {/* Accordion */}
          <motion.div variants={fadeInUp} className="space-y-3">
            {faqItems.map((item, index) => (
              <AccordionItem
                key={item.id}
                question={item.question}
                answer={item.answer}
                isOpen={openId === item.id}
                onToggle={() => handleToggle(item.id)}
                index={index}
              />
            ))}
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            variants={fadeInUp}
            className="mt-10 text-center bg-dark-blue rounded-2xl px-6 py-8"
          >
            <p className="font-serif text-xl font-semibold text-white mb-2">
              Noch Fragen?
            </p>
            <p className="text-white/70 text-sm mb-5">
              Wir sind für euch da! Schreibt uns einfach eine Nachricht.
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 bg-gold text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-gold-dark transition-colors"
            >
              Kontakt aufnehmen
            </a>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
