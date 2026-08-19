import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="faq">{children}</PageVisibilityGate>
}
