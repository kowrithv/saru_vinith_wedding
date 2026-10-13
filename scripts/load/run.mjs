#!/usr/bin/env node
// Lasttest gegen einen LOKALEN Produktions-Build (die Szenarien schreiben Daten):
//   npm run build
//   DATABASE_PATH=/tmp/lasttest/wedding.db npx next start -p 3124
//   node scripts/load/run.mjs http://localhost:3124 --guests=500 --upload-password=<Kennwort>
// Exit-Code 0 = alles bestanden, 1 = Befund.
import { isLocalUrl } from './lib.mjs'
import { formatLoadReport, runScenarios } from './scenarios.mjs'

const [baseUrl, ...rest] = process.argv.slice(2)
const flags = Object.fromEntries(
  rest
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split('=')
      return [key, value.length ? value.join('=') : 'true']
    })
)

if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
  console.error('Aufruf: node scripts/load/run.mjs <http://localhost:3124> [--guests=500] [--concurrency=100] [--upload-password=...]')
  process.exit(2)
}
if (!isLocalUrl(baseUrl) && flags['allow-remote'] !== 'true') {
  console.error(
    'Abbruch: Die Szenarien schreiben Stimmen, Gästebuch-Einträge und einen Rekord. ' +
      'Nur gegen einen lokalen Test-Server ausführen (oder bewusst mit --allow-remote).'
  )
  process.exit(2)
}

const guests = Number(flags.guests ?? 500)
const concurrency = Number(flags.concurrency ?? 100)
const started = Date.now()
const reports = await runScenarios({
  baseUrl,
  guests,
  concurrency,
  uploadPassword: flags['upload-password'],
})
console.log(formatLoadReport(reports))
console.log(`Dauer: ${((Date.now() - started) / 1000).toFixed(1)} s (${guests} Gäste, ${concurrency} gleichzeitig)`)
process.exit(reports.some((r) => r.failed > 0 || r.checks.some((c) => !c.ok)) ? 1 : 0)
