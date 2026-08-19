import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="info">{children}</PageVisibilityGate>
}
