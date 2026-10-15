import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  // Kein next/image: Fotos kommen als <img> von der Foto-Domain. Der
  // Bild-Optimierer (/_next/image) bliebe sonst erreichbar und wäre reine
  // Angriffsfläche (siehe Review K3/M1).
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
