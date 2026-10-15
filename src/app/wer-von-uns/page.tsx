import SectionTitle from '@/components/ui/SectionTitle'
import WhoKnowsUsGame from '@/components/sections/WhoKnowsUsGame'

export default function WhoPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Wer von uns?"
          subtitle="Stimmt ab, wer von uns beiden eher zutrifft. Die Auflösung gibt es bei der Feier!"
        />
        <WhoKnowsUsGame />
      </div>
    </div>
  )
}
