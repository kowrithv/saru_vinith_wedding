// Best-effort: Cache-Purge ist nie Voraussetzung für erfolgreiches Löschen.
// Fehlende Zugangsdaten (noch nicht eingerichtet) oder ein fehlschlagender
// HTTP-Call dürfen das Löschen der R2-Objekte/DB-Zeile nie verhindern.
export async function purgeCache(urls: string[]): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zoneId || urls.length === 0) {
    return
  }

  try {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: urls }),
    })
  } catch (error) {
    console.warn('Cloudflare-Cache-Purge fehlgeschlagen, Löschen läuft trotzdem weiter.', error)
  }
}
