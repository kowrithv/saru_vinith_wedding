import { isPageUnlocked, readSettings, pageLabels, type PageKey } from '@/lib/site-settings'
import ComingSoon from '@/components/sections/ComingSoon'

interface PageVisibilityGateProps {
  pageKey: PageKey
  children: React.ReactNode
}

export default async function PageVisibilityGate({ pageKey, children }: PageVisibilityGateProps) {
  const settings = await readSettings()
  const entry = settings.pages[pageKey]

  if (!isPageUnlocked(entry)) {
    return <ComingSoon title={pageLabels[pageKey]} enabled={entry.enabled} revealAt={entry.revealAt} />
  }

  return <>{children}</>
}
