import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="story">{children}</PageVisibilityGate>
}
