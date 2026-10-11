'use client'

import { useState } from 'react'
import { Plus, Minus, HelpCircle } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import { faqItems } from '@/lib/faq-content'
import { cn } from '@/lib/utils'

interface AccordionItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

function AccordionItem({ question, answer, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        isOpen ? 'border-dark-blue/20 bg-dark-blue/[0.02] shadow-sm' : 'border-gray-100 bg-white'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            'font-medium text-sm md:text-base leading-snug',
            isOpen ? 'text-dark-blue' : 'text-gray-800'
          )}
        >
          {question}
        </span>
        <span
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
            isOpen ? 'bg-dark-blue' : 'bg-gray-100'
          )}
        >
          {isOpen ? <Minus size={14} className="text-white" /> : <Plus size={14} className="text-gray-600" />}
        </span>
      </button>

      {isOpen && (
        <div className="px-6 pb-5">
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null)

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Häufige Fragen"
          subtitle="Hier findet ihr Antworten auf die wichtigsten Fragen rund um unsere Hochzeit."
        />

        <div className="flex items-center gap-3 bg-champagne/40 rounded-2xl p-4 mb-8 border border-champagne-dark/20">
          <HelpCircle size={20} className="text-dark-blue flex-shrink-0" />
          <p className="text-sm text-dark-blue">
            Noch weitere Fragen? Schreibt uns einfach eine{' '}
            <a href="mailto:hallo@saru-vinith.de" className="font-semibold underline underline-offset-2">
              E-Mail
            </a>
            , wir antworten gerne!
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item) => (
            <AccordionItem
              key={item.id}
              question={item.question}
              answer={item.answer}
              isOpen={openId === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
