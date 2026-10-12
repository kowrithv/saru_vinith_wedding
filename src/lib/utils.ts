import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export interface TimeUntil {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
  total: number
}

/**
 * Zeit bis zu einem absoluten Zeitpunkt (ISO-8601 mit Offset oder "Z").
 * Ohne Offset würde der String in der Zeitzone des Geräts gelesen.
 */
export function calculateTimeUntil(target: string, now: number = Date.now()): TimeUntil {
  const diff = Date.parse(target) - now

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, total: 0 }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, isPast: false, total: diff }
}
