import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string, formatStr: string = 'dd. MMMM yyyy'): string {
  try {
    const date = parseISO(dateString)
    return format(date, formatStr, { locale: de })
  } catch {
    return dateString
  }
}

export interface TimeUntil {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
  total: number
}

export function calculateTimeUntil(targetDate: string, targetTime?: string): TimeUntil {
  const now = new Date()
  const target = new Date(`${targetDate}T${targetTime || '00:00'}:00`)
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, total: 0 }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, isPast: false, total: diff }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trimEnd() + '...'
}
