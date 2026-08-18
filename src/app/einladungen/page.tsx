import type { Metadata } from 'next'
import InvitationCards from '@/components/sections/InvitationCards'

export const metadata: Metadata = {
  title: 'Einladungen',
  description: 'Unsere Einladungskarten zur standesamtlichen Trauung und zur Reception – Saruga & Vinith.',
}

export default function EinladungenPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-champagne-light/20 pt-24">
      <InvitationCards />
    </div>
  )
}
