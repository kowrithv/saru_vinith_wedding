import PageVisibilityGate from '@/components/PageVisibilityGate'

export const dynamic = 'force-dynamic'

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <PageVisibilityGate pageKey="gallery">{children}</PageVisibilityGate>
}
