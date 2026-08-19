import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function MemorySpielLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="memory-spiel">{children}</PageVisibilityGate>
}
