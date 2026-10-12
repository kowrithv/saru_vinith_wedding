'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  id: string
  title: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}

export default function CollapsibleSection({ id, title, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const headingId = `${id}-heading`
  const panelId = `${id}-panel`

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="font-serif text-lg font-semibold text-dark-blue mb-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 py-2 text-left"
        >
          <span>{count === undefined ? title : `${title} (${count})`}</span>
          <ChevronDown size={18} className={cn('flex-shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
      </h3>
      {/* hidden statt bedingtem Rendern: Formularzustand (z. B. laufende
          Uploads) darf beim Einklappen nicht verloren gehen. */}
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}
