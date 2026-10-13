#!/usr/bin/env node
// Smoke-Test nach einem Deploy:
//   node scripts/smoke.mjs https://vsjourney.de
//   SMOKE_ADMIN_PASSWORD=... node scripts/smoke.mjs https://vsjourney.de
// Exit-Code 0 = alles in Ordnung, 1 = mindestens eine Prüfung fehlgeschlagen.
import { formatReport, runSmokeChecks } from './lib/smoke-checks.mjs'

const baseUrl = process.argv[2]
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
  console.error('Aufruf: node scripts/smoke.mjs <https://domain> (optional SMOKE_ADMIN_PASSWORD)')
  process.exit(2)
}

const results = await runSmokeChecks(baseUrl, fetch, {
  adminPassword: process.env.SMOKE_ADMIN_PASSWORD || undefined,
})
console.log(formatReport(results))
process.exit(results.some((r) => !r.ok) ? 1 : 0)
