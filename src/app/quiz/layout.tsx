import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="quiz">{children}</PageVisibilityGate>
}
