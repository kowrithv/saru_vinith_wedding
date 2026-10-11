import { MissingEnvError, validateEnv } from '@/lib/env'

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
