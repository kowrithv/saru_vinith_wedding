import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="contact">{children}</PageVisibilityGate>
}
