'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Timer, MousePointerClick, Trophy } from 'lucide-react'
import Button from '@/components/ui/Button'
import { memoryImages, MEMORY_PAIRS_COUNT } from '@/lib/memory-content'
import { formatTime } from '@/lib/format-time'

const STORAGE_KEY = 'memory-spiel-best'

interface MemoryCard {
  id: string
  faceIndex: number
  isMatched: boolean
}

interface BestScore {
  moves: number
  seconds: number
}

interface GameState {
  faces: string[]
  cards: MemoryCard[]
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickFaces(): string[] {
  return shuffle(memoryImages).slice(0, MEMORY_PAIRS_COUNT)
}

function createShuffledDeck(faces: string[]): MemoryCard[] {
  const pairs = faces.flatMap((_, faceIndex) => [
    { id: crypto.randomUUID(), faceIndex, isMatched: false },
    { id: crypto.randomUUID(), faceIndex, isMatched: false },
  ])
  return shuffle(pairs)
}

function createNewGame(): GameState {
  const faces = pickFaces()
  return { faces, cards: createShuffledDeck(faces) }
}

function loadBestScore(): BestScore | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function MemoryGame() {
  const [game, setGame] = useState<GameState>(createNewGame)
  const [flippedIds, setFlippedIds] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [bestScore, setBestScore] = useState<BestScore | null>(loadBestScore)
  // Rekord über alle Gäste (nur Züge und Zeit, ohne Namen), vom Server.
  const [globalRecord, setGlobalRecord] = useState<BestScore | null>(null)
  const [isNewGlobalRecord, setIsNewGlobalRecord] = useState(false)
  // Antworten können in anderer Reihenfolge eintreffen, als die Anfragen
  // gestartet wurden (langsames WLAN): nur die jeweils neueste zählt.
  const requestSeqRef = useRef(0)
  const appliedSeqRef = useRef(0)

  const { faces, cards } = game
  const locked = flippedIds.length === 2
  const isWon = cards.length > 0 && cards.every((c) => c.isMatched)

  // Werden in effektgestützten Zeitfenstern (Timeout/Interval-Callbacks)
  // gebraucht, wo React-State sonst veraltet wäre - Refs halten den
  // jeweils aktuellsten Wert, synchronisiert nach jedem Commit.
  const movesRef = useRef(moves)
  const secondsRef = useRef(seconds)
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    movesRef.current = moves
  }, [moves])

  useEffect(() => {
    secondsRef.current = seconds
  }, [seconds])

  useEffect(() => {
    if (isWon) return
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isWon])

  // Gemeinsamen Rekord laden. Fehler (offline, Server down) sind bewusst
  // egal: das Spiel funktioniert auch ohne die Rekordanzeige.
  useEffect(() => {
    let cancelled = false
    const seq = ++requestSeqRef.current
    fetch('/api/memory-record')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { record: BestScore | null } | null) => {
        if (cancelled || !data || seq <= appliedSeqRef.current) return
        appliedSeqRef.current = seq
        setGlobalRecord(data.record)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Beim Gewinnen genau einmal das Ergebnis melden; die Antwort enthält den
  // aktuellen Rekord und ob dieses Spiel ihn gebrochen hat.
  useEffect(() => {
    if (!isWon) return
    // "gameOver" wird beim Start eines neuen Spiels (und beim Entladen) wahr:
    // eine späte Antwort darf dann den Rekord aktualisieren, aber nicht mehr
    // melden, dass DIESES Spiel ihn gebrochen hat.
    let gameOver = false
    const seq = ++requestSeqRef.current
    fetch('/api/memory-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moves: movesRef.current, seconds: secondsRef.current }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { record: BestScore; isNewRecord: boolean } | null) => {
        if (!data) return
        if (seq > appliedSeqRef.current) {
          appliedSeqRef.current = seq
          setGlobalRecord(data.record)
        }
        if (!gameOver) setIsNewGlobalRecord(Boolean(data.isNewRecord))
      })
      .catch(() => {})
    return () => {
      gameOver = true
    }
  }, [isWon])

  useEffect(() => {
    return () => {
      if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current)
    }
  }, [])

  const startNewGame = () => {
    if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current)
    setGame(createNewGame())
    setFlippedIds([])
    setMoves(0)
    setSeconds(0)
    setIsNewGlobalRecord(false)
  }

  const isCardVisible = (card: MemoryCard) => card.isMatched || flippedIds.includes(card.id)

  const handleCardClick = (card: MemoryCard) => {
    if (locked || card.isMatched || flippedIds.includes(card.id)) return

    if (flippedIds.length === 0) {
      setFlippedIds([card.id])
      return
    }

    const firstId = flippedIds[0]
    setFlippedIds([firstId, card.id])
    setMoves((m) => m + 1)

    const first = cards.find((c) => c.id === firstId)
    const isMatch = Boolean(first && first.faceIndex === card.faceIndex)

    resolveTimeoutRef.current = setTimeout(() => {
      if (isMatch) {
        setGame((prev) => {
          const updatedCards = prev.cards.map((c) =>
            c.id === firstId || c.id === card.id ? { ...c, isMatched: true } : c
          )
          if (updatedCards.every((c) => c.isMatched)) {
            const candidate: BestScore = { moves: movesRef.current, seconds: secondsRef.current }
            setBestScore((prevBest) => {
              const isBetter =
                !prevBest ||
                candidate.moves < prevBest.moves ||
                (candidate.moves === prevBest.moves && candidate.seconds < prevBest.seconds)
              const next = isBetter ? candidate : prevBest
              try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
              } catch {
                // ignore write errors (e.g. private browsing)
              }
              return next
            })
          }
          return { ...prev, cards: updatedCards }
        })
      }
      setFlippedIds([])
    }, isMatch ? 500 : 900)
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-4 sm:gap-8 mb-3 text-sm">
        <div className="flex items-center gap-2 text-dark-blue font-medium">
          <MousePointerClick size={16} className="text-gold" />
          {moves} Züge
        </div>
        <div className="flex items-center gap-2 text-dark-blue font-medium">
          <Timer size={16} className="text-gold" />
          {formatTime(seconds)}
        </div>
      </div>
      {/* Die Zeile reserviert ihre Höhe von Anfang an: sonst springt das Brett
          nach unten, sobald der Rekord geladen ist, und Tipps landen daneben. */}
      <div
        data-testid="memory-record-row"
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mb-6 min-h-11 text-xs sm:text-sm text-gray-600"
      >
          {bestScore && (
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-gold" />
              Deine Bestzeit: {bestScore.moves} Züge · {formatTime(bestScore.seconds)}
            </div>
          )}
          {globalRecord && (
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-gold" />
              Rekord aller Gäste: {globalRecord.moves} Züge · {formatTime(globalRecord.seconds)}
            </div>
          )}
      </div>

      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {cards.map((card) => {
          const face = faces[card.faceIndex]
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
                <div className="absolute inset-0 rounded-xl bg-dark-blue flex items-center justify-center [backface-visibility:hidden] shadow-sm">
                  <Heart size={18} className="text-white/30" />
                </div>
                <div
                  className={`absolute inset-0 rounded-xl overflow-hidden flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)] border-2 ${
                    card.isMatched ? 'border-green-400' : 'border-champagne-dark/30'
                  }`}
                >
                  {face && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={face} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              </motion.div>
            </button>
          )
        })}
      </div>

      {isWon && (
        <div className="text-center mt-8" role="status">
          <p className="font-serif text-xl font-semibold text-dark-blue mb-4">Geschafft! 🎉</p>
          {isNewGlobalRecord && (
            <p className="text-gold-text font-medium mb-4">Neuer Rekord aller Gäste! 🏆</p>
          )}
          <Button onClick={startNewGame}>Neues Spiel</Button>
        </div>
      )}
      {!isWon && (
        <div className="text-center mt-8">
          <Button variant="secondary" onClick={startNewGame}>
            Neues Spiel
          </Button>
        </div>
      )}
    </div>
  )
}
