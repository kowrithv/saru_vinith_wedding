import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function MemoriesLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="memories">{children}</PageVisibilityGate>
}
