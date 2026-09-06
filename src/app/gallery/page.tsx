'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, ZoomIn, Upload, User, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { galleryImages } from '@/lib/config'
import type { GalleryUpload } from '@/lib/gallery-uploads'

const categories = ['Alle', 'Kennenlernen', 'Verlobung', 'Paarfotos', 'Empfang']

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

interface DisplayImage {
  id: string
  src: string
  alt: string
  category: string
  width: number
  height: number
  isUpload?: boolean
  uploaderName?: string
}

function uploadToDisplayImage(upload: GalleryUpload): DisplayImage {
  return {
    id: upload.id,
    src: upload.src,
    alt: `Foto von ${upload.uploaderName}`,
    category: upload.category,
    width: 800,
    height: 600,
    isUpload: true,
    uploaderName: upload.uploaderName,
  }
}

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [uploads, setUploads] = useState<GalleryUpload[]>([])
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [uploadPassword, setUploadPassword] = useState('')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/gallery', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: GalleryUpload[]) => setUploads(data))
      .catch(() => {})
  }, [])

  const allImages: DisplayImage[] = [...galleryImages, ...uploads.map(uploadToDisplayImage)]

  const filteredImages =
    activeCategory === 'Alle'
      ? allImages
      : allImages.filter((img) => img.category === activeCategory)

  const handleUploadFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploadFiles(files)
    setUploadPreviews(files.map((file) => URL.createObjectURL(file)))
  }

  const resetUploadForm = () => {
    uploadPreviews.forEach((url) => URL.revokeObjectURL(url))
    setUploaderName('')
    setUploadPassword('')
    setUploadFiles([])
    setUploadPreviews([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploaderName.trim()) {
      toast.error('Bitte gib deinen Namen ein.')
      return
    }
    if (!uploadPassword.trim()) {
      toast.error('Bitte gib das Kennwort für deine Veranstaltung ein.')
      return
    }
    if (uploadFiles.length === 0) {
      toast.error('Bitte wähle mindestens ein Foto aus.')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('uploaderName', uploaderName.trim())
      formData.append('password', uploadPassword)
      uploadFiles.forEach((file) => formData.append('file', file))

      const response = await fetch('/api/gallery/upload', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data?.error || 'Hochladen fehlgeschlagen.')
        return
      }

      const newEntries = data as GalleryUpload[]
      setUploads((prev) => [...newEntries, ...prev])
      toast.success(`${newEntries.length} Foto${newEntries.length === 1 ? '' : 's'} hochgeladen – danke! 📸`)
      resetUploadForm()
      setShowUploadForm(false)
    } catch {
      toast.error('Hochladen fehlgeschlagen. Bitte versuch es erneut.')
    } finally {
      setIsUploading(false)
    }
  }

  const openLightbox = (index: number) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)

  const navigateLightbox = useCallback(
    (direction: 'prev' | 'next') => {
      if (lightboxIndex === null) return
      const newIndex =
        direction === 'prev'
          ? (lightboxIndex - 1 + filteredImages.length) % filteredImages.length
          : (lightboxIndex + 1) % filteredImages.length
      setLightboxIndex(newIndex)
    },
    [lightboxIndex, filteredImages.length]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') navigateLightbox('prev')
      if (e.key === 'ArrowRight') navigateLightbox('next')
    },
    [navigateLightbox]
  )

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeInUp}>
            <SectionTitle
              title="Unsere Galerie"
              subtitle="Momente, die wir für immer in Erinnerung behalten – vom ersten Treffen bis heute."
            />
          </motion.div>

          {/* Category filter */}
          <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === category
                    ? 'bg-dark-blue text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-champagne hover:text-dark-blue'
                }`}
              >
                {category}
                {category !== 'Alle' && (
                  <span className="ml-1.5 text-xs opacity-60">
                    ({allImages.filter((img) => img.category === category).length})
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Upload toggle */}
          <motion.div variants={fadeInUp} className="flex justify-center mb-10">
            <Button variant="secondary" size="sm" onClick={() => setShowUploadForm((v) => !v)}>
              <Upload size={14} />
              {showUploadForm ? 'Upload schließen' : 'Eigenes Foto hochladen'}
            </Button>
          </motion.div>

          {/* Upload form */}
          <AnimatePresence>
            {showUploadForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-10"
              >
                <Card padding="lg" className="max-w-lg mx-auto">
                  <form onSubmit={handleUploadSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <User size={14} className="inline mr-1" />
                        Dein Name *
                      </label>
                      <input
                        type="text"
                        value={uploaderName}
                        onChange={(e) => setUploaderName(e.target.value)}
                        placeholder="Wie heißt du?"
                        maxLength={60}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <Lock size={14} className="inline mr-1" />
                        Kennwort deiner Veranstaltung *
                      </label>
                      <input
                        type="text"
                        value={uploadPassword}
                        onChange={(e) => setUploadPassword(e.target.value)}
                        placeholder="Kennwort von der Einladung"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Ordnet deine Fotos automatisch der richtigen Veranstaltung zu.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Fotos * <span className="text-gray-400 font-normal">(mehrere möglich)</span>
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-dark-blue hover:bg-gray-50 transition-all duration-200"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleUploadFilesChange}
                          className="hidden"
                        />
                        {uploadPreviews.length > 0 ? (
                          <div className="grid grid-cols-4 gap-2">
                            {uploadPreviews.map((preview, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={preview} alt="Vorschau" className="w-full h-16 rounded-lg object-cover" />
                            ))}
                          </div>
                        ) : (
                          <>
                            <Upload size={24} className="text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Fotos hier auswählen</p>
                            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP oder GIF, je max. 8 MB</p>
                          </>
                        )}
                      </div>
                      {uploadPreviews.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          {uploadPreviews.length} Foto{uploadPreviews.length === 1 ? '' : 's'} ausgewählt · Klicken zum Ändern
                        </p>
                      )}
                    </div>

                    <Button type="submit" variant="primary" size="md" className="w-full" disabled={isUploading}>
                      {isUploading ? 'Wird hochgeladen...' : 'Fotos teilen'}
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Masonry grid */}
          <motion.div
            layout
            className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4"
          >
            <AnimatePresence>
              {filteredImages.map((image, index) => (
                <motion.div
                  key={image.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="break-inside-avoid mb-4 cursor-pointer group relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  onClick={() => openLightbox(index)}
                >
                  <div className="relative w-full">
                    {image.isUpload ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <Image
                        src={image.src}
                        alt={image.alt}
                        width={image.width}
                        height={image.height}
                        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-dark-blue/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <ZoomIn size={28} className="text-white" />
                    </div>
                    {/* Category badge */}
                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="inline-block bg-white/90 text-dark-blue text-xs font-medium px-2 py-1 rounded-full">
                        {image.isUpload ? `Von ${image.uploaderName}` : image.category}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {filteredImages.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">Keine Bilder in dieser Kategorie</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {/* Close button */}
            <button
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              onClick={closeLightbox}
              aria-label="Schließen"
            >
              <X size={20} />
            </button>

            {/* Prev button */}
            <button
              className="absolute left-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); navigateLightbox('prev') }}
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Next button */}
            <button
              className="absolute right-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); navigateLightbox('next') }}
              aria-label="Nächstes Bild"
            >
              <ChevronRight size={24} />
            </button>

            {/* Image */}
            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl max-h-[85vh] mx-8"
              onClick={(e) => e.stopPropagation()}
            >
              {filteredImages[lightboxIndex].isUpload ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={filteredImages[lightboxIndex].src}
                  alt={filteredImages[lightboxIndex].alt}
                  className="max-h-[80vh] w-auto h-auto object-contain rounded-lg mx-auto"
                />
              ) : (
                <Image
                  src={filteredImages[lightboxIndex].src}
                  alt={filteredImages[lightboxIndex].alt}
                  width={filteredImages[lightboxIndex].width}
                  height={filteredImages[lightboxIndex].height}
                  className="max-h-[80vh] w-auto h-auto object-contain rounded-lg"
                />
              )}
              <div className="text-center mt-3">
                <p className="text-white/70 text-sm">{filteredImages[lightboxIndex].alt}</p>
                <p className="text-white/40 text-xs mt-1">
                  {lightboxIndex + 1} / {filteredImages.length}
                </p>
              </div>
            </motion.div>

            {/* Keyboard hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs flex gap-4">
              <span>← → Navigieren</span>
              <span>ESC Schließen</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
