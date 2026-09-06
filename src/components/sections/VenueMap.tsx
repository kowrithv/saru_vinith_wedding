'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigation, MapPinned } from 'lucide-react'

interface VenueMapProps {
  lat: number
  lng: number
  label: string
  address: string
}

const buttonClasses =
  'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 active:scale-[0.98] text-sm px-6 py-2.5'

export default function VenueMap({ lat, lng, label, address }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`

  useEffect(() => {
    let cancelled = false

    import('leaflet').then((leafletModule) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const L = leafletModule.default

      // Next.js/Webpack löst die Standard-Marker-Icons von Leaflet nicht automatisch auf –
      // deshalb laden wir sie explizit von einem CDN statt vom (fehlenden) lokalen Pfad.
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>-Mitwirkende',
        maxZoom: 19,
      }).addTo(map)

      L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<strong>${label}</strong><br/>${address}`)
        .openPopup()
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng, label, address])

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      <div ref={containerRef} className="w-full h-64 md:h-80" />
      <div className="flex flex-col sm:flex-row gap-3 p-4">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClasses} bg-dark-blue text-white hover:bg-dark-blue-light shadow-md hover:shadow-lg flex-1`}
        >
          <Navigation size={16} />
          Route planen
        </a>
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClasses} border-2 border-dark-blue text-dark-blue hover:bg-dark-blue hover:text-white flex-1`}
        >
          <MapPinned size={16} />
          Auf OpenStreetMap ansehen
        </a>
      </div>
    </div>
  )
}
