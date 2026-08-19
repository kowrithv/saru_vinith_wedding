'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Heart, Gem, Plane, Camera, MapPin, Calendar, Sparkles, Star,
  Trophy, RefreshCw, Timer, MousePointerClick, type LucideIcon,
} from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import HeartBurst from '@/components/ui/HeartBurst'
import { generateId } from '@/lib/utils'
import { memoryGameImages } from '@/lib/config'

const FALLBACK_ICONS: LucideIcon[] = [Heart, Gem, Plane, Camera, MapPin, Calendar, Sparkles, Star]
const TOTAL_PAIRS = 8
const STORAGE_KEY = 'saru_vinith_memory_best'

type CardFace = { kind: 'image'; src: string } | { kind: 'icon'; Icon: LucideIcon }

// Uses real photos from memoryGameImages first (see src/lib/config.ts), and
// fills any remaining pairs with icons so the board always has 8 pairs.
const FACES: CardFace[] = [
  ...memoryGameImages.slice(0, TOTAL_PAIRS).map((src): CardFace => ({ kind: 'image', src })),
  ...FALLBACK_ICONS.slice(0, Math.max(0, TOTAL_PAIRS - memoryGameImages.length)).map(
    (Icon): CardFace => ({ kind: 'icon', Icon })
  ),
]

interface MemoryCard {
  id: string
  faceIndex: number
  isMatched: boolean
}

interface BestScore {
  moves: number
  seconds: number
}

function createShuffledDeck(): MemoryCard[] {
  const pairs = FACES.flatMap((_, faceIndex) => [
    { id: generateId(), faceIndex, isMatched: false },
    { id: generateId(), faceIndex, isMatched: false },
  ])
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  return pairs
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function MemoryGame() {
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [flippedIds, setFlippedIds] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isWon, setIsWon] = useState(false)
  const [bestScore, setBestScore] = useState<BestScore | null>(null)
  const [burstTrigger, setBurstTrigger] = useState(0)

  const startNewGame = () => {
    setCards(createShuffledDeck())
    setFlippedIds([])
    setLocked(false)
    setMoves(0)
    setSeconds(0)
    setIsRunning(true)
    setIsWon(false)
  }

  useEffect(() => {
    startNewGame()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setBestScore(JSON.parse(raw))
    } catch {
      // ignore corrupt localStorage
    }
  }, [])

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    if (flippedIds.length !== 2) return
    setLocked(true)
    setMoves((m) => m + 1)

    const [firstId, secondId] = flippedIds
    const first = cards.find((c) => c.id === firstId)
    const second = cards.find((c) => c.id === secondId)
    const isMatch = first && second && first.faceIndex === second.faceIndex

    const timeout = setTimeout(() => {
      if (isMatch) {
        setCards((prev) =>
          prev.map((c) => (c.id === firstId || c.id === secondId ? { ...c, isMatched: true } : c))
        )
      }
      setFlippedIds([])
      setLocked(false)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, isMatch ? 500 : 900)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flippedIds])

  useEffect(() => {
    if (cards.length === 0) return
    const allMatched = cards.every((c) => c.isMatched)
    if (!allMatched || isWon) return

    setIsWon(true)
    setIsRunning(false)
    setBurstTrigger((t) => t + 1)

    setBestScore((prev) => {
      const candidate: BestScore = { moves, seconds }
      const isBetter = !prev || candidate.moves < prev.moves || (candidate.moves === prev.moves && candidate.seconds < prev.seconds)
      const next = isBetter ? candidate : prev
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore write errors (e.g. private browsing)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])

  const isCardVisible = (card: MemoryCard) => card.isMatched || flippedIds.includes(card.id)

  const handleCardClick = (card: MemoryCard) => {
    if (locked || card.isMatched || flippedIds.includes(card.id) || flippedIds.length === 2) return
    setFlippedIds((prev) => [...prev, card.id])
  }

  const gridCards = useMemo(() => cards, [cards])

  return (
    <div className="min-h-screen bg-gradient-to-b from-champagne-light/20 to-white pt-24 pb-16">
      <HeartBurst trigger={burstTrigger} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionTitle
            title="Gästespiel: Liebes-Memory"
            subtitle="Findet alle Pärchen! Deckt zwei Karten auf – passen die Symbole zusammen, bleiben sie offen."
          />

          {/* Stats bar */}
          <div className="flex items-center justify-center gap-4 sm:gap-8 mb-6 text-sm">
            <div className="flex items-center gap-2 text-dark-blue font-medium">
              <MousePointerClick size={16} className="text-gold" />
              {moves} Züge
            </div>
            <div className="flex items-center gap-2 text-dark-blue font-medium">
              <Timer size={16} className="text-gold" />
              {formatTime(seconds)}
            </div>
            {bestScore && (
              <div className="flex items-center gap-2 text-gray-400">
                <Trophy size={16} className="text-gold" />
                Bestzeit: {bestScore.moves} Züge · {formatTime(bestScore.seconds)}
              </div>
            )}
          </div>

          {/* Board */}
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            {gridCards.map((card) => {
              const face = FACES[card.faceIndex]
              const visible = isCardVisible(card)
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardClick(card)}
                  disabled={visible}
                  className="aspect-square [perspective:600px]"
                  aria-label="Karte umdrehen"
                >
                  <motion.div
                    className="relative w-full h-full [transform-style:preserve-3d]"
                    animate={{ rotateY: visible ? 180 : 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    {/* Back (visible when face-down) */}
                    <div
                      className="absolute inset-0 rounded-xl bg-dark-blue flex items-center justify-center [backface-visibility:hidden] shadow-sm"
                    >
                      <Heart size={18} className="text-white/30" />
                    </div>
                    {/* Front (revealed) */}
                    <div
                      className={`absolute inset-0 rounded-xl overflow-hidden flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)] border-2 ${
                        card.isMatched
                          ? 'border-green-400'
                          : 'border-champagne-dark/30'
                      }`}
                    >
                      {face.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={face.src} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${card.isMatched ? 'bg-green-50' : 'bg-champagne-light'}`}>
                          <face.Icon size={24} className={card.isMatched ? 'text-green-600' : 'text-dark-blue'} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </button>
              )
            })}
          </div>

          {/* Win banner */}
          {isWon && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-center bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
            >
              <div className="w-16 h-16 bg-champagne rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy size={28} className="text-gold" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-dark-blue mb-2">
                Geschafft! 🎉
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                {moves} Züge · {formatTime(seconds)} — danke fürs Mitspielen!
              </p>
              <Button variant="primary" size="lg" onClick={startNewGame}>
                <RefreshCw size={16} />
                Nochmal spielen
              </Button>
            </motion.div>
          )}

          {!isWon && (
            <div className="mt-8 text-center">
              <Button variant="ghost" size="sm" onClick={startNewGame}>
                <RefreshCw size={14} />
                Neu mischen
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
