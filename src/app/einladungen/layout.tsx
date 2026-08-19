import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function EinladungenLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="einladungen">{children}</PageVisibilityGate>
}
