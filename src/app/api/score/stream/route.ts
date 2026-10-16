import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasScoreAccess } from '@/lib/score-auth'
import { getScore } from '@/lib/score'
import { scoreSubscriberCount, subscribeScore } from '@/lib/score-hub'

// Der Stream hält die Verbindung offen und schickt jede Änderung sofort (Server-Sent
// Events). Er darf nie vorab gebaut oder zwischengespeichert werden.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Hält Proxys (Caddy, Cloudflare) und Handy-Netze davon ab, die ruhige Leitung zu kappen.
// Ein echtes Ereignis (kein Kommentar): nur so merkt die Seite, dass die Leitung noch lebt.
const HEARTBEAT_MS = 10_000
// Beamer plus ein paar Handys; mehr offene Streams wären ein Leck oder Missbrauch.
const MAX_STREAMS = 50
// Liest ein Gerät nicht mehr (Verbindung halb tot), stauen sich die Nachrichten: ab hier wird es getrennt.
const MAX_BACKLOG = 20

export async function GET(request: Request): Promise<Response> {
  const db = getDb()
  if (!hasScoreAccess(request, db)) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  if (scoreSubscriberCount() >= MAX_STREAMS) {
    return NextResponse.json({ error: 'Zu viele offene Anzeigen.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
  }

  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let heartbeat: ReturnType<typeof setInterval> | undefined
      let unsubscribe = () => {}

      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // schon geschlossen
        }
      }

      // Ein Fehler hier (Verbindung weg) darf nie nach außen: im Timer wäre er ein Absturz des Prozesses.
      const send = (text: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          cleanup()
          return
        }
        if (controller.desiredSize !== null && controller.desiredSize < -MAX_BACKLOG) cleanup()
      }

      unsubscribe = subscribeScore((score) => send(`data: ${JSON.stringify(score)}\n\n`))
      heartbeat = setInterval(() => send('event: ping\ndata: 1\n\n'), HEARTBEAT_MS)

      // `retry`: so lange wartet der Browser vor dem nächsten Verbindungsversuch (Standard wären 3 s).
      send(`retry: 2000\n\ndata: ${JSON.stringify(getScore(db))}\n\n`)

      if (request.signal.aborted) cleanup()
      else request.signal.addEventListener('abort', cleanup, { once: true })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform: kein Zwischenspeicher verändert oder sammelt den Strom.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // nginx-artige Proxys sammeln sonst die Antwort, bevor sie weitergeht.
      'X-Accel-Buffering': 'no',
    },
  })
}
