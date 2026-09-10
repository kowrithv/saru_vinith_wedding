'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Image as ImageIcon, Video, X, Plus, Heart, Play, type LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { mockMemories } from '@/lib/config'
import { Memory } from '@/types'

type TabType = 'text' | 'photo' | 'video'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 30 * 1024 * 1024

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

function MemoryCard({ memory, onOpen }: { memory: Memory; onOpen: (memory: Memory) => void }) {
  const iconMap = {
    text: FileText,
    photo: ImageIcon,
    video: Video,
  }
  const Icon = iconMap[memory.type]
  const typeLabel = { text: 'Erinnerung', photo: 'Foto', video: 'Video' }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
    >
      <Card hover className="h-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-champagne rounded-full flex items-center justify-center flex-shrink-0">
            <Icon size={16} className="text-dark-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-dark-blue truncate">{memory.name}</p>
            <p className="text-xs text-gray-400">{typeLabel[memory.type]}</p>
          </div>
        </div>

        {memory.type === 'text' && memory.content && (
          <p className="text-sm text-gray-600 leading-relaxed italic">
            &quot;{memory.content}&quot;
          </p>
        )}

        {memory.type === 'photo' && memory.mediaUrl && (
          <button
            type="button"
            onClick={() => onOpen(memory)}
            className="mt-2 w-full rounded-lg overflow-hidden group relative"
            aria-label="Foto vergrößern"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={memory.mediaUrl} alt="Hochzeitserinnerung" className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-dark-blue/0 group-hover:bg-dark-blue/30 transition-colors duration-200" />
          </button>
        )}

        {memory.type === 'video' && (
          <button
            type="button"
            onClick={() => memory.mediaUrl && onOpen(memory)}
            disabled={!memory.mediaUrl}
            className="mt-2 w-full rounded-lg overflow-hidden relative bg-gray-900 h-24 flex items-center justify-center group disabled:cursor-default"
            aria-label="Video abspielen"
          >
            {memory.mediaUrl ? (
              <>
                <video src={memory.mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-70" muted preload="metadata" />
                <div className="relative w-9 h-9 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play size={16} className="text-dark-blue fill-dark-blue ml-0.5" />
                </div>
              </>
            ) : (
              <Video size={24} className="text-gray-400" />
            )}
          </button>
        )}

        <p className="text-xs text-gray-400 mt-3 text-right">
          {new Date(memory.createdAt).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </Card>
    </motion.div>
  )
}

function MemoryLightbox({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
        onClick={onClose}
        aria-label="Schließen"
      >
        <X size={20} />
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="max-w-3xl max-h-[85vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {memory.type === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memory.mediaUrl}
            alt={memory.content || 'Hochzeitserinnerung'}
            className="max-h-[80vh] w-auto h-auto object-contain rounded-lg mx-auto"
          />
        ) : (
          <video
            src={memory.mediaUrl}
            controls
            autoPlay
            className="max-h-[80vh] w-auto h-auto object-contain rounded-lg mx-auto"
          />
        )}
        <div className="text-center mt-3">
          <p className="text-white/80 text-sm font-medium">{memory.name}</p>
          {memory.content && <p className="text-white/50 text-xs mt-1">{memory.content}</p>}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function MemoriesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('text')
  const [memories, setMemories] = useState<Memory[]>(mockMemories)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lightboxMemory, setLightboxMemory] = useState<Memory | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/memories', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Memory[]) => {
        setMemories(
          [...data, ...mockMemories].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        )
      })
      .catch(() => {})
  }, [])

  const handleFileSelect = (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    const maxBytes = isImage ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES

    if (file.size > maxBytes) {
      toast.error(`Datei zu groß (max. ${Math.round(maxBytes / (1024 * 1024))} MB).`)
      return
    }

    setFileName(file.name)
    setSelectedFile(file)
    if (isImage || isVideo) {
      const reader = new FileReader()
      reader.onload = (e) => setPreviewUrl(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreviewUrl(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Bitte gib deinen Namen ein.')
      return
    }
    if (activeTab === 'text' && !content.trim()) {
      toast.error('Bitte schreib deine Erinnerung.')
      return
    }
    if ((activeTab === 'photo' || activeTab === 'video') && !fileName) {
      toast.error('Bitte wähle eine Datei aus.')
      return
    }

    setIsSubmitting(true)

    let mediaUrl: string | undefined
    if ((activeTab === 'photo' || activeTab === 'video') && selectedFile) {
      try {
        const formData = new FormData()
        formData.append('file', selectedFile)
        const response = await fetch('/api/memories/upload', { method: 'POST', body: formData })
        const data = await response.json()
        if (!response.ok) {
          toast.error(data?.error || 'Hochladen fehlgeschlagen.')
          setIsSubmitting(false)
          return
        }
        mediaUrl = data.url
      } catch {
        toast.error('Hochladen fehlgeschlagen. Bitte versuch es erneut.')
        setIsSubmitting(false)
        return
      }
    }

    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type: activeTab, content: content.trim(), mediaUrl }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error || 'Speichern fehlgeschlagen.')
        setIsSubmitting(false)
        return
      }
      setMemories((prev) => [data as Memory, ...prev])
    } catch {
      toast.error('Speichern fehlgeschlagen. Bitte versuch es erneut.')
      setIsSubmitting(false)
      return
    }

    setName('')
    setContent('')
    setPreviewUrl(null)
    setSelectedFile(null)
    setFileName(null)
    setIsSubmitting(false)

    toast.success('Deine Erinnerung wurde gespeichert! 💙')
  }

  const tabs: { id: TabType; label: string; icon: LucideIcon }[] = [
    { id: 'text', label: 'Erinnerung', icon: FileText },
    { id: 'photo', label: 'Foto', icon: ImageIcon },
    { id: 'video', label: 'Video', icon: Video },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-champagne-light/20 pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeInUp}>
            <SectionTitle
              title="Erinnerungen"
              subtitle="Teilt eure schönsten Momente und Gedanken mit uns – für immer Teil unserer Geschichte."
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Upload form */}
            <motion.div variants={fadeInUp}>
              <Card padding="lg">
                <h3 className="font-serif text-xl font-semibold text-dark-blue mb-5">
                  Erinnerung hinzufügen
                </h3>

                {/* Tab buttons */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6 gap-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setFileName(null)
                        setPreviewUrl(null)
                        setSelectedFile(null)
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-white text-dark-blue shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <tab.icon size={15} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Dein Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Wie heißt du?"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                    />
                  </div>

                  {/* Content based on tab */}
                  <AnimatePresence mode="wait">
                    {activeTab === 'text' ? (
                      <motion.div
                        key="text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Deine Erinnerung *
                        </label>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="Schreib uns eine Erinnerung, einen Wunsch oder eine Nachricht..."
                          rows={5}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm resize-none"
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="file"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {activeTab === 'photo' ? 'Foto hochladen *' : 'Video hochladen *'}
                        </label>

                        {/* Drop zone */}
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                            dragOver
                              ? 'border-dark-blue bg-champagne/30'
                              : 'border-gray-200 hover:border-dark-blue hover:bg-gray-50'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={activeTab === 'photo' ? 'image/*' : 'video/*'}
                            onChange={handleFileChange}
                            className="hidden"
                          />

                          {previewUrl ? (
                            <div className="relative">
                              {activeTab === 'photo' ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={previewUrl} alt="Vorschau" className="max-h-40 mx-auto rounded-lg object-cover" />
                              ) : (
                                <video src={previewUrl} controls className="max-h-40 mx-auto rounded-lg" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setPreviewUrl(null); setFileName(null); setSelectedFile(null) }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : fileName ? (
                            <div>
                              <Video size={32} className="text-dark-blue mx-auto mb-2" />
                              <p className="text-sm font-medium text-dark-blue">{fileName}</p>
                              <p className="text-xs text-gray-400 mt-1">Klicken zum Ändern</p>
                            </div>
                          ) : (
                            <>
                              <Upload size={28} className="text-gray-300 mx-auto mb-3" />
                              <p className="text-sm text-gray-500">
                                {activeTab === 'photo' ? 'Foto' : 'Video'} hier ablegen
                              </p>
                              <p className="text-xs text-gray-400 mt-1">oder klicken zum Auswählen</p>
                            </>
                          )}
                        </div>

                        {/* Optional text note */}
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Notiz (optional)
                          </label>
                          <input
                            type="text"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Kurze Beschreibung..."
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Wird gespeichert...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Erinnerung teilen
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            </motion.div>

            {/* Memories display */}
            <motion.div variants={fadeInUp}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-serif text-xl font-semibold text-dark-blue flex items-center gap-2">
                  <Heart size={18} className="text-gold fill-gold" />
                  Erinnerungen ({memories.length})
                </h3>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                <AnimatePresence>
                  {memories.map((memory) => (
                    <MemoryCard key={memory.id} memory={memory} onOpen={setLightboxMemory} />
                  ))}
                </AnimatePresence>
                {memories.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Heart size={32} className="mx-auto mb-3 opacity-30" />
                    <p>Noch keine Erinnerungen. Sei der Erste!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {lightboxMemory && (
          <MemoryLightbox memory={lightboxMemory} onClose={() => setLightboxMemory(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
