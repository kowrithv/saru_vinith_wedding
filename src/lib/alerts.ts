import type Database from 'better-sqlite3'
import nodemailer from 'nodemailer'
import { getDb } from '@/lib/db'
import { getConfigValue, setConfigValue } from '@/lib/app-config'

export const DEFAULT_COOLDOWN_MS = 6 * 60 * 60 * 1000

export interface SmtpSettings {
  host: string
  port: number
  user?: string
  password?: string
  from: string
  to: string[]
}

export interface AlertInput {
  key: string
  subject: string
  body: string
  cooldownMs?: number
}

export interface SendAlertOptions {
  db?: Database.Database
  now?: () => number
  env?: NodeJS.ProcessEnv
  createTransport?: typeof nodemailer.createTransport
}

export type AlertResult = 'sent' | 'logged' | 'suppressed' | 'failed'

export function readSmtpSettings(env: NodeJS.ProcessEnv = process.env): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim()
  const from = env.SMTP_FROM?.trim()
  const to = (env.ALERT_EMAIL_TO ?? '')
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter(Boolean)
  if (!host || !from || to.length === 0) return null

  const port = Number.parseInt(env.SMTP_PORT ?? '', 10) || 587
  return {
    host,
    port,
    user: env.SMTP_USER || undefined,
    password: env.SMTP_PASSWORD || undefined,
    from,
    to,
  }
}

/**
 * Meldet ein Betriebsproblem: immer ins Log, zusätzlich per E-Mail, wenn SMTP
 * konfiguriert ist. Wirft nie - ein defekter Mailserver darf weder eine
 * Anfrage noch den Scheduler stören. Je `key` gibt es eine Abkühlzeit, die in
 * der Datenbank steht und Neustarts überlebt.
 */
export async function sendAlert(input: AlertInput, options: SendAlertOptions = {}): Promise<AlertResult> {
  const now = options.now ?? Date.now
  const env = options.env ?? process.env
  const createTransport = options.createTransport ?? nodemailer.createTransport.bind(nodemailer)
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS
  const configKey = `alert_last_sent:${input.key}`

  try {
    const db = options.db ?? getDb()
    const last = Number(getConfigValue(db, configKey) ?? '0')
    if (now() - last < cooldownMs) return 'suppressed'

    console.warn(`[alert] ${input.subject} - ${input.body}`)

    const settings = readSmtpSettings(env)
    if (!settings) {
      setConfigValue(db, configKey, String(now()))
      return 'logged'
    }

    const transport = createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.port === 465,
      requireTLS: settings.port !== 465,
      auth: settings.user ? { user: settings.user, pass: settings.password } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
    await transport.sendMail({
      from: settings.from,
      to: settings.to.join(', '),
      subject: `[Hochzeitsseite] ${input.subject}`,
      text: input.body,
    })
    setConfigValue(db, configKey, String(now()))
    return 'sent'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[alert] Versand fehlgeschlagen (${input.subject}): ${message}`)
    return 'failed'
  }
}
