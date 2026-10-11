import { MissingEnvError, validateEnv } from '@/lib/env'

// Diese App läuft immer als eigenständiger Node-Server (Docker), nie auf
// Vercels Edge Runtime - process.exit() ist dort ohnehin nicht verfügbar.
export const runtime = 'nodejs'

export function register(): void {
  try {
    validateEnv()
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error(`FEHLER: ${error.message}`)
      process.exit(1)
      return
    }
    throw error
  }
}
