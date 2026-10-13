import { InvalidEnvError, MissingEnvError, validateEnv } from '@/lib/env'

// Diese App läuft immer als eigenständiger Node-Server (Docker), nie auf
// Vercels Edge Runtime - process.exit() ist dort ohnehin nicht verfügbar.
export const runtime = 'nodejs'

async function startOpsInBackground(): Promise<void> {
  // Backup und Alarme nur im echten Server: nicht in Tests, nicht in dev.
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { startOpsScheduler } = await import('@/lib/ops-scheduler')
    startOpsScheduler()
  } catch (error) {
    console.error('Ops-Scheduler konnte nicht gestartet werden:', error)
  }
}

export function register(): void {
  try {
    validateEnv()
  } catch (error) {
    if (error instanceof MissingEnvError || error instanceof InvalidEnvError) {
      console.error(`FEHLER: ${error.message}`)
      process.exit(1)
      return
    }
    throw error
  }
  void startOpsInBackground()
}
