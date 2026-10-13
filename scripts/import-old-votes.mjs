#!/usr/bin/env node
// Übernimmt die Stimmen der alten Seite in die neue.
//
//   node scripts/import-old-votes.mjs <who-votes.json> <https://vsjourney.de>          # Probelauf
//   node scripts/import-old-votes.mjs <who-votes.json> <https://vsjourney.de> --apply  # wirklich senden
//
// Ein zweiter Lauf legt nichts doppelt an (feste Kennung je alter Stimme).
import { readFileSync } from 'node:fs'
import { importVotes, parseOldVotes } from './lib/old-votes.mjs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const [file, baseUrl] = args.filter((arg) => !arg.startsWith('--'))

if (!file || !baseUrl) {
  console.error('Aufruf: node scripts/import-old-votes.mjs <who-votes.json> <basis-url> [--apply]')
  process.exit(2)
}

let data
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  console.error(`Datei nicht lesbar: ${error instanceof Error ? error.message : error}`)
  process.exit(2)
}

const { votes, problems } = parseOldVotes(data)
for (const problem of problems) console.warn(`Hinweis: ${problem}`)
console.log(`${votes.length} Stimme(n) gefunden. ${apply ? 'Sende an' : 'Probelauf für'} ${baseUrl}`)

const results = await importVotes({ baseUrl, votes, apply })
for (const { vote, status, detail } of results) {
  console.log(`  Frage ${vote.questionId} · ${vote.option} · ${status}${detail ? ` (${detail})` : ''}`)
}

const count = (status) => results.filter((r) => r.status === status).length
if (apply) {
  console.log(`Übernommen: ${count('imported')}, schon vorhanden: ${count('already-there')}, abgewiesen: ${count('rejected')}, Fehler: ${count('failed')}.`)
  process.exit(count('rejected') + count('failed') > 0 ? 1 : 0)
} else {
  console.log('Probelauf - nichts gesendet. Mit --apply wirklich übernehmen.')
}
