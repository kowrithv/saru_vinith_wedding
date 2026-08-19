import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function GuestbookLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="guestbook">{children}</PageVisibilityGate>
}
