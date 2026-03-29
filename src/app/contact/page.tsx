'use client'

import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Mail, Phone, Send, User, MessageSquare, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

const contactInfo = [
  {
    icon: Mail,
    label: 'E-Mail',
    value: 'hallo@saru-vinith.de',
    subvalue: 'Wir antworten innerhalb von 24 Stunden',
    href: 'mailto:hallo@saru-vinith.de',
  },
  {
    icon: Phone,
    label: 'Telefon',
    value: '+49 (0) 123 456789',
    subvalue: 'Mo–Fr, 9:00–18:00 Uhr',
    href: 'tel:+49123456789',
  },
]

export default function ContactPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>()

  const onSubmit = async (data: ContactFormData) => {
    await new Promise((r) => setTimeout(r, 1000))
    console.log('Form submitted:', data)
    toast.success('Nachricht gesendet! Wir melden uns bald. 💙')
    reset()
  }

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
              title="Kontakt"
              subtitle="Habt ihr Fragen, Anmerkungen oder möchtet euch anmelden? Schreibt uns!"
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Contact info */}
            <motion.div variants={fadeInUp} className="lg:col-span-2 space-y-5">
              {/* Contact cards */}
              {contactInfo.map((info) => (
                <a key={info.label} href={info.href} className="block">
                  <Card hover className="group">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 bg-dark-blue rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-dark-blue-light transition-colors">
                        <info.icon size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                          {info.label}
                        </p>
                        <p className="font-semibold text-dark-blue text-sm">{info.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{info.subvalue}</p>
                      </div>
                    </div>
                  </Card>
                </a>
              ))}

              {/* RSVP info */}
              <Card variant="champagne" className="border-2 border-champagne-dark/30">
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-dark-blue flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-dark-blue text-sm mb-1">
                      Anmeldung / RSVP
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Bitte meldet euch bis zum{' '}
                      <strong>1. September 2026</strong> an.
                      Gebt in der Nachricht bitte die Anzahl der Personen und eventuelle Unverträglichkeiten an.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Quick info */}
              <div className="bg-dark-blue rounded-2xl p-5 text-white">
                <p className="font-serif text-lg font-semibold mb-3">Schnelle Infos</p>
                <ul className="space-y-2 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-gold rounded-full" />
                    RSVP bis: 1. September 2026
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-gold rounded-full" />
                    Standesamt: 17. Oktober 2026
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-gold rounded-full" />
                    Tamilische Hochzeit: 2027
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* Contact form */}
            <motion.div variants={fadeInUp} className="lg:col-span-3">
              <Card padding="lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-champagne rounded-xl flex items-center justify-center">
                    <MessageSquare size={18} className="text-dark-blue" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-dark-blue">
                    Nachricht senden
                  </h3>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <User size={14} className="inline mr-1" />
                      Dein Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Vorname Nachname"
                      {...register('name', {
                        required: 'Bitte gib deinen Namen ein.',
                        minLength: { value: 2, message: 'Name zu kurz.' },
                      })}
                      className={`w-full px-4 py-2.5 border rounded-xl focus:ring-1 outline-none transition-colors text-sm ${
                        errors.name
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                          : 'border-gray-200 focus:border-dark-blue focus:ring-dark-blue'
                      }`}
                    />
                    {errors.name && (
                      <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <Mail size={14} className="inline mr-1" />
                      E-Mail *
                    </label>
                    <input
                      type="email"
                      placeholder="deine@email.de"
                      {...register('email', {
                        required: 'Bitte gib deine E-Mail-Adresse ein.',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Ungültige E-Mail-Adresse.',
                        },
                      })}
                      className={`w-full px-4 py-2.5 border rounded-xl focus:ring-1 outline-none transition-colors text-sm ${
                        errors.email
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                          : 'border-gray-200 focus:border-dark-blue focus:ring-dark-blue'
                      }`}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Betreff
                    </label>
                    <select
                      {...register('subject')}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm bg-white"
                    >
                      <option value="">Betreff auswählen...</option>
                      <option value="rsvp">Anmeldung / RSVP</option>
                      <option value="question">Allgemeine Frage</option>
                      <option value="hotel">Hotel & Unterkunft</option>
                      <option value="dresscode">Dresscode</option>
                      <option value="gift">Geschenke</option>
                      <option value="other">Sonstiges</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nachricht *
                    </label>
                    <textarea
                      placeholder="Schreib uns deine Frage oder Nachricht..."
                      rows={6}
                      {...register('message', {
                        required: 'Bitte schreib eine Nachricht.',
                        minLength: { value: 10, message: 'Nachricht zu kurz (min. 10 Zeichen).' },
                      })}
                      className={`w-full px-4 py-2.5 border rounded-xl focus:ring-1 outline-none transition-colors text-sm resize-none ${
                        errors.message
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                          : 'border-gray-200 focus:border-dark-blue focus:ring-dark-blue'
                      }`}
                    />
                    {errors.message && (
                      <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>
                    )}
                  </div>

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
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Nachricht senden
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-400 text-center">
                    Wir verwenden deine Daten nur, um dir zu antworten.
                  </p>
                </form>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
