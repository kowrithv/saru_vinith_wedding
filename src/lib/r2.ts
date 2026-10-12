import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let client: S3Client | undefined

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
      // AWS SDK v3 signiert PUT-Requests seit einer neueren Version
      // standardmäßig mit einem zusätzlichen x-amz-checksum-crc32-Header.
      // R2 ist S3-kompatibel, aber nicht identisch - ein echter Browser-
      // Upload mit echten Bytes würde die (für einen leeren Body
      // berechnete) signierte Prüfsumme nicht erfüllen und fehlschlagen.
      // 'WHEN_REQUIRED' schaltet das automatische Senden ab.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    })
  }
  return client
}

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  contentLength?: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  })
  // Der Presigner schließt content-type standardmäßig von der Signatur aus.
  // Ohne diese Option könnte ein Ticket-Inhaber den Inhaltstyp frei wählen
  // (z. B. text/html unter original.jpg auf der öffentlichen Foto-Domain);
  // so muss der PUT exakt den serverseitig geprüften Typ senden.
  return getSignedUrl(getClient(), command, {
    expiresIn: 15 * 60,
    signableHeaders: new Set(['content-type']),
  })
}

export interface HeadObjectResult {
  size: number
}

export async function headObject(key: string): Promise<HeadObjectResult | null> {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })
    )
    return { size: result.ContentLength ?? 0 }
  } catch {
    return null
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    })
  )
}
