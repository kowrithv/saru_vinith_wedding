import { InvalidEnvError, MissingEnvError, validateEnv } from '@/lib/env'

// Nur für die Node-Laufzeit (siehe instrumentation.ts): process.exit() und der
// Ops-Scheduler gibt es in der Edge-Runtime nicht.

async function startOpsInBackground(): Promise<void> {
  // Backup und Alarme nur im echten Server: nicht in Tests, nicht in dev.
  if (process.env.NODE_ENV !== 'production') return
  try {
    const { startOpsScheduler } = await import('@/lib/ops-scheduler')
    startOpsScheduler()
  } catch (error) {
    console.error('Ops-Scheduler konnte nicht gestartet werden:', error)
  }
}

export function registerNode(): void {
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
