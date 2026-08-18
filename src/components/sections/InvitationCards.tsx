'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  Heart, Mail, X, ChevronLeft, ChevronRight,
  Calendar, Clock, MapPin, Shirt, Eye,
} from 'lucide-react'
import { couple, civilWedding } from '@/lib/config'

// ─────────────────────────────────────────────────────────────────────────────
// Floating petals (static positions → no SSR mismatch)
// ─────────────────────────────────────────────────────────────────────────────
const PETALS = [
  { l:  5, d:  0,   dur: 14, s: 10, x:  40 },
  { l: 15, d:  3.2, dur: 11, s:  7, x: -30 },
  { l: 25, d:  1.5, dur: 13, s: 12, x:  50 },
  { l: 38, d:  5,   dur: 10, s:  8, x: -40 },
  { l: 50, d:  2,   dur: 15, s: 11, x:  30 },
  { l: 62, d:  7,   dur: 12, s:  9, x: -50 },
  { l: 74, d:  0.5, dur: 11, s: 13, x:  45 },
  { l: 84, d:  4,   dur: 14, s:  7, x: -35 },
  { l: 93, d:  6,   dur: 12, s: 10, x:  55 },
]
function Petals() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {PETALS.map((p, i) => (
        <motion.div key={i} className="absolute"
          style={{ left: `${p.l}%`, top: '-20px' }}
          animate={{ y: '110vh', x: [0, p.x, p.x * 0.5, p.x * 0.8], rotate: [0, 180, 300, 360] }}
          transition={{ duration: p.dur, delay: p.d, repeat: Infinity, ease: 'linear' }}>
          <svg width={p.s} height={p.s * 1.5} viewBox="0 0 10 15" fill="none">
            <path d="M5 0 C2 3 0 7 0 10 C0 13 2 15 5 15 C8 15 10 13 10 10 C10 7 8 3 5 0Z"
              fill="rgba(201,168,76,0.22)" />
          </svg>
        </motion.div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ornamental border (SVG overlay on each card)
// ─────────────────────────────────────────────────────────────────────────────
function OrnamentalBorder({ color = '#C9A84C' }: { color?: string }) {
  return (
    <svg viewBox="0 0 300 420" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
      <rect x="7" y="7" width="286" height="406" rx="7" stroke={color} strokeWidth="1.2" opacity="0.55"/>
      <rect x="13" y="13" width="274" height="394" rx="5" stroke={color} strokeWidth="0.5" opacity="0.3"/>
      {/* Corner dots */}
      <circle cx="7" cy="7" r="2.5" fill={color} opacity="0.65"/>
      <circle cx="293" cy="7" r="2.5" fill={color} opacity="0.65"/>
      <circle cx="7" cy="413" r="2.5" fill={color} opacity="0.65"/>
      <circle cx="293" cy="413" r="2.5" fill={color} opacity="0.65"/>
      {/* Corner arcs */}
      <path d="M7 38 C7 21 21 7 38 7" stroke={color} strokeWidth="1.1" opacity="0.75" fill="none"/>
      <path d="M293 38 C293 21 279 7 262 7" stroke={color} strokeWidth="1.1" opacity="0.75" fill="none"/>
      <path d="M7 382 C7 399 21 413 38 413" stroke={color} strokeWidth="1.1" opacity="0.75" fill="none"/>
      <path d="M293 382 C293 399 279 413 262 413" stroke={color} strokeWidth="1.1" opacity="0.75" fill="none"/>
      {/* Top center ornament */}
      <path d="M120 7 C135 16 148 16 150 7 C152 16 165 16 180 7" stroke={color} strokeWidth="0.7" opacity="0.45" fill="none"/>
      <circle cx="150" cy="7" r="1.8" fill={color} opacity="0.55"/>
      {/* Bottom center ornament */}
      <path d="M120 413 C135 404 148 404 150 413 C152 404 165 404 180 413" stroke={color} strokeWidth="0.7" opacity="0.45" fill="none"/>
      <circle cx="150" cy="413" r="1.8" fill={color} opacity="0.55"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function GoldLine({ light = false }: { light?: boolean }) {
  const op = light ? 0.28 : 0.55
  return (
    <div className="flex items-center gap-2 w-full justify-center my-2">
      <div className="h-px flex-1 max-w-[50px]" style={{ background: `linear-gradient(to right,transparent,rgba(201,168,76,${op}))` }} />
      <Heart size={7} fill="#C9A84C" color="#C9A84C" style={{ opacity: op + 0.1 }} />
      <div className="h-px flex-1 max-w-[50px]" style={{ background: `linear-gradient(to left,transparent,rgba(201,168,76,${op}))` }} />
    </div>
  )
}

function VSMonogram() {
  return (
    <motion.div className="relative w-16 h-16 flex items-center justify-center my-1"
      animate={{ filter: ['drop-shadow(0 0 3px rgba(201,168,76,0.3))','drop-shadow(0 0 8px rgba(201,168,76,0.7))','drop-shadow(0 0 3px rgba(201,168,76,0.3))'] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 w-full h-full" fill="none">
        <path d="M32 3 L58 18 L58 46 L32 61 L6 46 L6 18 Z" stroke="#C9A84C" strokeWidth="1.4" opacity="0.65"/>
        <path d="M32 9 L53 22 L53 42 L32 55 L11 42 L11 22 Z" stroke="#C9A84C" strokeWidth="0.5" opacity="0.35"/>
        <polygon points="32,1 35,5 32,9 29,5" fill="#C9A84C" opacity="0.65"/>
        <polygon points="32,55 35,59 32,63 29,59" fill="#C9A84C" opacity="0.65"/>
      </svg>
      <span className="relative font-serif text-base font-bold text-gold tracking-widest z-10">VS</span>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Card faces
// ─────────────────────────────────────────────────────────────────────────────
function CivilFace() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center px-7 py-8 text-center select-none"
      style={{ background: 'linear-gradient(155deg,#1E3A5F 0%,#152940 55%,#0F1F35 100%)' }}>
      {/* dot grid */}
      <div className="absolute inset-0 opacity-[0.045]"
        style={{ backgroundImage: 'radial-gradient(circle,rgba(201,168,76,0.8) 1px,transparent 1px)', backgroundSize: '26px 26px' }} />
      <OrnamentalBorder />
      <div className="relative z-10 flex flex-col items-center w-full">
        <p className="text-gold/55 text-[8px] tracking-[0.22em] uppercase font-sans mb-1">
          Two Hearts · One Journey
        </p>
        <GoldLine />
        <VSMonogram />
        <GoldLine />
        <p className="font-serif text-white/80 text-[11px] italic mb-0.5">Wir laden herzlich ein zur</p>
        <p className="font-serif text-champagne text-[13px] tracking-[0.25em] uppercase font-semibold"
          style={{ color: '#F5E6C8' }}>
          Standesamtlichen Trauung
        </p>
        <GoldLine />
        <h2 className="font-serif text-white text-lg font-semibold leading-tight">
          {couple.groom}
        </h2>
        <p className="text-gold/60 font-serif text-sm italic">&amp;</p>
        <h2 className="font-serif text-white text-lg font-semibold leading-tight">
          {couple.bride}
        </h2>
        <GoldLine />
        <motion.p className="font-serif text-gold text-2xl font-bold tracking-[0.15em]"
          animate={{ opacity: [0.75, 1, 0.75] }} transition={{ duration: 3, repeat: Infinity }}>
          17 · 10 · 2026
        </motion.p>
        <p className="text-white/55 text-[9px] tracking-[0.2em] uppercase mt-1">
          {civilWedding.time} Uhr
        </p>
        <GoldLine light />
        <p className="text-white/45 text-[8.5px] font-sans leading-relaxed tracking-wide mt-0.5">
          {civilWedding.venue}<br/>
          <span className="text-white/30">{civilWedding.address}</span>
        </p>
      </div>
    </div>
  )
}

const DRESS_COLORS = [
  { name: 'Navy Blue',  hex: '#1E3A5F' },
  { name: 'Baby Blue',  hex: '#B8D4E8' },
  { name: 'Champagne',  hex: '#F5E6C8' },
  { name: 'Beige',      hex: '#E8DCC8' },
]

function DresscodeFace() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center px-7 py-8 text-center select-none"
      style={{ background: 'linear-gradient(155deg,#FDFAF5 0%,#F5EDD8 100%)' }}>
      <OrnamentalBorder color="#A8892E" />
      <div className="relative z-10 flex flex-col items-center w-full">
        <p className="text-dark-blue/40 text-[8px] tracking-[0.22em] uppercase font-sans mb-1">Standesamtliche Trauung</p>
        <GoldLine />
        <h2 className="font-serif text-dark-blue text-2xl font-semibold tracking-wide">Dresscode</h2>
        <GoldLine />
        <p className="text-dark-blue/55 text-[8.5px] tracking-[0.18em] uppercase font-sans">
          Navy Blue · Baby Blue · Champagne
        </p>
        <div className="flex gap-3 mt-3 mb-1">
          {DRESS_COLORS.map((c) => (
            <div key={c.name} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full shadow border border-white/70"
                style={{ backgroundColor: c.hex }} />
              <span className="text-dark-blue/45 text-[7px] font-sans text-center leading-tight max-w-[36px]">{c.name}</span>
            </div>
          ))}
        </div>
        <GoldLine />
        <div className="text-left w-full space-y-2">
          <div>
            <p className="text-dark-blue/40 text-[7.5px] tracking-widest uppercase font-sans mb-0.5">Herren</p>
            <p className="text-dark-blue/70 text-[9.5px] font-sans leading-relaxed">
              Anzüge in den Dresscode-Farben
            </p>
          </div>
          <div className="w-full h-px" style={{ background: 'linear-gradient(to right,transparent,rgba(201,168,76,0.35),transparent)' }} />
          <div>
            <p className="text-dark-blue/40 text-[7.5px] tracking-widest uppercase font-sans mb-0.5">Damen</p>
            <p className="text-dark-blue/70 text-[9.5px] font-sans leading-relaxed">
              Kleider in Dresscode-Farben<br/>
              Laura Dress · Nancy · Baguet<br/>
              <span className="text-dark-blue/45 italic">Kein Lehenga</span>
            </p>
          </div>
        </div>
        <GoldLine light />
        <motion.p className="font-serif text-dark-blue/55 text-sm italic tracking-wider"
          animate={{ opacity: [0.45, 0.8, 0.45] }} transition={{ duration: 3.5, repeat: Infinity }}>
          Matte Old Money
        </motion.p>
      </div>
    </div>
  )
}

function ReceptionFace() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center px-7 py-8 text-center select-none"
      style={{ background: 'linear-gradient(155deg,#FFFAF6 0%,#F8F0EA 100%)' }}>
      <OrnamentalBorder color="#9B4B6E" />
      <div className="relative z-10 flex flex-col items-center w-full">
        <p className="text-dark-blue/40 text-[8px] tracking-[0.22em] uppercase font-sans mb-1">
          Together with their families
        </p>
        <GoldLine />
        <VSMonogram />
        <GoldLine />
        <p className="text-dark-blue/55 text-[9px] font-sans italic leading-relaxed max-w-[180px]">
          Request the pleasure of your company at the
        </p>
        <p className="font-serif text-dark-blue text-sm tracking-[0.28em] uppercase font-semibold mt-1">
          Reception
        </p>
        <GoldLine />
        <motion.h2 className="font-serif text-dark-blue text-xl font-bold leading-tight"
          animate={{ opacity: [0.82, 1, 0.82] }} transition={{ duration: 3, repeat: Infinity }}>
          {couple.groom} &amp; {couple.bride}
        </motion.h2>
        <GoldLine />
        <p className="text-dark-blue/45 text-[8.5px] tracking-[0.2em] uppercase font-sans">Saturday</p>
        <motion.p className="font-serif text-dark-blue text-xl font-semibold tracking-widest mt-0.5"
          animate={{ opacity: [0.78, 1, 0.78] }} transition={{ duration: 3, repeat: Infinity }}>
          17 October 2026
        </motion.p>
        <p className="text-dark-blue/55 text-[9px] tracking-[0.2em] uppercase">at 3 PM</p>
        <GoldLine light />
        <p className="text-dark-blue/55 text-[9.5px] font-sans leading-relaxed">
          Oberkirchener Weg 42<br/>
          <span className="text-dark-blue/38 text-[8.5px]">41189 Mönchengladbach</span>
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Image viewer modal
// ─────────────────────────────────────────────────────────────────────────────
function ImageViewer({ pages, title, onClose }: { pages: string[]; title: string; onClose: () => void }) {
  const [page, setPage] = useState(0)
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl bg-white"
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.88, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full" style={{ paddingBottom: '133%' }}>
          <Image src={pages[page]} alt={`${title} – Seite ${page + 1}`} fill
            className="object-contain" sizes="400px" priority />
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />
        </div>
        <button onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors z-10"
          aria-label="Schließen">
          <X size={14} />
        </button>
        {pages.length > 1 && (
          <>
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors z-10"
                aria-label="Vorherige Seite"><ChevronLeft size={16} /></button>
            )}
            {page < pages.length - 1 && (
              <button onClick={() => setPage(p => p + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors z-10"
                aria-label="Nächste Seite"><ChevronRight size={16} /></button>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {pages.map((_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === page ? 'bg-white scale-125' : 'bg-white/45 hover:bg-white/75'}`}
                  aria-label={`Seite ${i + 1}`} />
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single card wrapper
// ─────────────────────────────────────────────────────────────────────────────
interface CardDef { id: string; label: string; pages: string[]; face: React.ReactNode }

function InvCard({ card, index }: { card: CardDef; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, delay: index * 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col items-center w-full max-w-[270px]">
        <motion.div
          className="relative w-full cursor-pointer group rounded-2xl"
          style={{ paddingBottom: '140%' }}
          whileHover={{ y: -8, boxShadow: '0 32px 64px rgba(30,58,95,0.22)' }}
          transition={{ duration: 0.35 }}
          onClick={() => setOpen(true)}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
          aria-label={`${card.label} – Originaleinladung öffnen`}>
          {/* card face fills the padded space */}
          {card.face}
          {/* hover hint */}
          <div className="absolute inset-0 rounded-2xl flex items-end justify-center pb-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-dark-blue text-[10px] font-medium shadow-md">
              <Eye size={11} />
              Original ansehen
            </span>
          </div>
        </motion.div>
        <p className="mt-3 text-sm font-medium text-gray-500 text-center">{card.label}</p>
      </motion.div>

      <AnimatePresence>
        {open && <ImageViewer pages={card.pages} title={card.label} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll-reveal info row
// ─────────────────────────────────────────────────────────────────────────────
function InfoBlock({ icon: Icon, label, value, delay = 0 }: {
  icon: React.ElementType; label: string; value: string | string[]; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-champagne shadow-sm hover:shadow-md transition-shadow">
      <div className="w-10 h-10 bg-champagne rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={18} className="text-dark-blue" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {Array.isArray(value)
          ? value.map((v, i) => <p key={i} className="text-sm font-semibold text-dark-blue">{v}</p>)
          : <p className="text-sm font-semibold text-dark-blue">{value}</p>
        }
      </div>
    </motion.div>
  )
}

const SCHEDULE = [
  { time: '13:30 Uhr', event: 'Einlass & Empfang der Gäste' },
  { time: '14:00 Uhr', event: 'Standesamtliche Trauungszeremonie' },
  { time: '15:00 Uhr', event: 'Sektempfang & Gratulationen' },
  { time: '15:30 Uhr', event: 'Reception – Empfang & Feier' },
  { time: 'Abend',     event: 'Gemeinsames Abendessen & Tanz' },
]

function ScrollRevealSection() {
  return (
    <div className="mt-20">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-px w-14 bg-gradient-to-r from-transparent to-gold/40" />
          <Heart size={9} className="text-gold fill-gold" />
          <div className="h-px w-14 bg-gradient-to-l from-transparent to-gold/40" />
        </div>
        <h3 className="font-serif text-2xl md:text-3xl font-semibold text-dark-blue mb-2">
          Alle Details auf einen Blick
        </h3>
        <p className="text-gray-400 text-sm">Alles was ihr für den großen Tag wissen müsst</p>
      </motion.div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-12">
        <InfoBlock icon={Calendar} label="Datum"   value={civilWedding.displayDate}        delay={0}    />
        <InfoBlock icon={Clock}    label="Uhrzeit"  value={civilWedding.time + ' Uhr'}      delay={0.08} />
        <InfoBlock icon={MapPin}   label="Ort"
          value={[civilWedding.venue, civilWedding.address]}                                delay={0.16} />
        <InfoBlock icon={Shirt}    label="Dresscode"
          value={['Navy Blue · Baby Blue', 'Champagne · Beige']}                            delay={0.24} />
      </div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="max-w-xl mx-auto bg-white rounded-2xl border border-champagne shadow-sm p-6 md:p-8">
        <h4 className="font-serif text-lg font-semibold text-dark-blue mb-6 flex items-center gap-2">
          <Clock size={16} className="text-gold" />
          Tagesablauf · 17. Oktober 2026
        </h4>
        <div className="space-y-5">
          {SCHEDULE.map((item, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="flex items-start gap-4">
              <div className="flex-shrink-0 w-[72px] text-right pt-0.5">
                <span className="inline-block text-[10px] font-semibold text-gold bg-champagne px-2 py-0.5 rounded-full whitespace-nowrap">
                  {item.time}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-1.5 h-1.5 rounded-full bg-dark-blue flex-shrink-0" />
                <p className="text-sm text-gray-600">{item.event}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Dresscode detail */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="max-w-xl mx-auto mt-6 rounded-2xl overflow-hidden">
        <div className="bg-dark-blue px-6 py-4 flex items-center gap-3">
          <Shirt size={16} className="text-gold" />
          <h4 className="font-serif text-white font-semibold">Dresscode – Matte Old Money</h4>
        </div>
        <div className="bg-white border border-champagne border-t-0 rounded-b-2xl px-6 py-5">
          <div className="flex gap-3 mb-5">
            {DRESS_COLORS.map(c => (
              <div key={c.name} className="flex flex-col items-center gap-1.5">
                <div className="w-9 h-9 rounded-full shadow-sm border border-gray-100" style={{ backgroundColor: c.hex }} />
                <span className="text-[8px] text-gray-500 text-center leading-tight max-w-[40px]">{c.name}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Herren</p>
              <p className="text-gray-600 text-xs leading-relaxed">Anzüge in den Dresscode-Farben</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Damen</p>
              <p className="text-gray-600 text-xs leading-relaxed">Kleider: Laura Dress, Nancy, Baguet<br/><em className="text-gray-400">Kein Lehenga</em></p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Card definitions
// ─────────────────────────────────────────────────────────────────────────────
const CARDS: CardDef[] = [
  {
    id: 'standesamt',
    label: 'Standesamtliche Trauung',
    pages: ['/invitations/standesamt-01.png', '/invitations/standesamt-02.png'],
    face: <CivilFace />,
  },
  {
    id: 'dresscode',
    label: 'Dresscode',
    pages: ['/invitations/standesamt-02.png'],
    face: <DresscodeFace />,
  },
  {
    id: 'reception',
    label: 'Empfang & Feier',
    pages: ['/invitations/reception.png'],
    face: <ReceptionFace />,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export default function InvitationCards() {
  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-b from-white to-champagne-light/30 overflow-hidden">
      <Petals />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-champagne text-dark-blue text-xs font-semibold rounded-full uppercase tracking-wider mb-5">
            <Mail size={12} />
            Einladungen
          </span>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
            <Heart size={10} className="text-gold fill-gold" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-dark-blue mb-3">
            Unsere Einladungskarten
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm md:text-base">
            Digitale Nachbildung unserer Einladungen.
            Klicke auf eine Karte, um die Originaleinladung zu öffnen.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {CARDS.map((card, i) => (
            <InvCard key={card.id} card={card} index={i} />
          ))}
        </div>

        {/* Scroll-reveal info section */}
        <ScrollRevealSection />

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center text-xs text-gray-400 mt-12">
          Einladungen zur tamilischen Hochzeitsfeier 2027 folgen rechtzeitig per Post.
        </motion.p>
      </div>
    </section>
  )
}
