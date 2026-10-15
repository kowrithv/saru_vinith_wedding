'use client'

import { CalendarPlus } from 'lucide-react'
import { downloadEventIcs } from '@/lib/calendar'

export default function SaveToCalendarButton() {
  return (
    <button
      type="button"
      onClick={downloadEventIcs}
      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-dark-blue px-5 py-2.5 text-sm font-medium text-dark-blue transition-colors hover:bg-dark-blue hover:text-white"
    >
      <CalendarPlus size={16} />
      In Kalender speichern
    </button>
  )
}
