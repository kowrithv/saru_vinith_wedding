import { google } from 'googleapis'
import { Readable } from 'stream'

// Optionaler Google-Drive-Sync für Gäste-Uploads (Galerie & Erinnerungen).
// Läuft über OAuth mit einem persönlichen Google-Konto (nicht über einen Service Account –
// Service Accounts haben kein eigenes Speicherkontingent und können auf einem privaten
// Google-Konto keine Dateien ablegen, siehe https://developers.google.com/workspace/drive/api/guides/about-shareddrives).
// Ohne konfigurierte Umgebungsvariablen bleibt diese Funktion inaktiv – die Uploads
// landen dann wie bisher nur lokal unter public/uploads/.

let cachedDrive: ReturnType<typeof google.drive> | null = null

function getOAuthCredentials(): { clientId: string; clientSecret: string; refreshToken: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken }
}

export function isDriveConfigured(): boolean {
  return Boolean(getOAuthCredentials())
}

function getDriveClient() {
  if (cachedDrive) return cachedDrive

  const credentials = getOAuthCredentials()
  if (!credentials) return null

  const oauth2Client = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret)
  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken })

  cachedDrive = google.drive({ version: 'v3', auth: oauth2Client })
  return cachedDrive
}

interface UploadToDriveParams {
  buffer: Buffer
  filename: string
  mimeType: string
  folderId: string
}

/**
 * Lädt eine Datei in einen Google-Drive-Ordner hoch. Gibt bei fehlender Konfiguration
 * oder einem Fehler `null` zurück, statt zu werfen – der lokale Upload bleibt so immer
 * die verlässliche Quelle, Drive ist nur ein Backup/Zusatz.
 */
export async function uploadToDrive({
  buffer,
  filename,
  mimeType,
  folderId,
}: UploadToDriveParams): Promise<{ id: string; webViewLink?: string | null } | null> {
  const drive = getDriveClient()
  if (!drive || !folderId) return null

  try {
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink',
    })
    return { id: response.data.id ?? '', webViewLink: response.data.webViewLink }
  } catch (error) {
    console.error('Google Drive Upload fehlgeschlagen:', error)
    return null
  }
}
