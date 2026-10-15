import Link from 'next/link'
import { ArrowRight, Users2 } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import ClassicQuiz from '@/components/sections/ClassicQuiz'

export default function QuizPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Hochzeits-Quiz"
          subtitle="Wie gut kennt ihr uns? Testet euer Wissen in 8 Fragen!"
        />

        <ClassicQuiz />

        <Link
          href="/wer-von-uns"
          className="mt-10 flex items-center gap-4 rounded-2xl border border-champagne-dark/50 bg-champagne-light px-5 py-4 text-dark-blue transition-colors hover:border-dark-blue"
        >
          <Users2 size={22} className="flex-shrink-0 text-gold-dark" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-serif text-lg font-semibold">Wer von uns?</span>
            <span className="block text-sm text-gray-600">
              Stimmt ab, wer von uns beiden eher zutrifft. Die Auflösung gibt es bei der Feier.
            </span>
          </span>
          <ArrowRight size={18} className="flex-shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
