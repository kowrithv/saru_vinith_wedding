import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { castVote } from '@/lib/who-votes'
import { isFeatureLocked } from '@/lib/app-config'
import { areResultsReleased } from '@/lib/who-results'
import { setGallerySessionCookie } from '@/lib/gallery-auth'
import { GuestRateLimiter, gateGuest } from '@/lib/guest-limits'

const voteSchema = z.object({
  questionId: z.string().min(1).max(50),
  voterId: z.string().min(1).max(100),
  option: z.string().min(1).max(50),
})

// Je Gerät (Sitzung): 14 Fragen und ein paar Wiederholungen nach Netzfehlern
// brauchen nie mehr als einige Dutzend; ein Skript mit erfundenen voterIds
// kommt so nicht weit. Ohne Sitzung (erste Stimme mit Kennwort, gemeinsames
// WLAN, das Einlese-Skript für die alten Stimmen) gilt eine großzügige
// Grenze je Adresse.
const voteLimiter = new GuestRateLimiter({ perDevice: 60, perAddress: 1500, windowMs: 15 * 60 * 1000 })

export async function POST(request: Request): Promise<Response> {
  const db = getDb()

  if (isFeatureLocked(db, 'who_votes')) {
    return NextResponse.json(
      { error: 'Abstimmen ist derzeit vorübergehend gesperrt.' },
      { status: 423 }
    )
  }
  // Mit der Auflösung ist die Abstimmung beendet: die gezeigten Ergebnisse
  // sollen sich nicht mehr ändern.
  if (areResultsReleased(db)) {
    return NextResponse.json({ error: 'Die Abstimmung ist beendet.' }, { status: 423 })
  }

  const body = await request.json().catch(() => null)

  // Kennwort (oder Sitzung) zuerst prüfen: ein falsches verrät nie, ob der
  // Rest gültig gewesen wäre.
  const candidatePassword =
    body && typeof body === 'object' ? (body as Record<string, unknown>).password : undefined
  const gate = gateGuest(request, db, candidatePassword)
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error },
      {
        status: gate.status,
        ...(gate.status === 429 ? { headers: { 'Retry-After': String(gate.retryAfterSeconds) } } : {}),
      }
    )
  }

  // Umfang je Gerät erst NACH der Kennwort-Prüfung: Anfragen ohne Kennwort
  // dürfen das Kontingent der Adresse nicht füllen.
  const limit = voteLimiter.check(request, db)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Stimmen. Bitte später erneut versuchen.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
    )
  }

  const parsed = voteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  try {
    const { alreadyVoted } = castVote(db, parsed.data.questionId, parsed.data.voterId, parsed.data.option)
    // Kein Zwischenstand in der Antwort: die Ergebnisse bleiben bis zur
    // Freigabe verborgen.
    const response = NextResponse.json({ alreadyVoted })
    // Mit dem Kennwort abgestimmt: den Browser gleich für Galerie, Gästebuch
    // und Erinnerungen entsperren.
    if (gate.issueSession) setGallerySessionCookie(response, db)
    return response
  } catch {
    return NextResponse.json({ error: 'Unbekannte Frage oder Antwort.' }, { status: 400 })
  }
}
