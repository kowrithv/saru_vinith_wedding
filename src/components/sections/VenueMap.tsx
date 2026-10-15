'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import SaveToCalendarButton from '@/components/sections/SaveToCalendarButton'

interface VenueMapProps {
  lat: number
  lng: number
  label: string
  address: string
  /** Hinweis zum Parken; ohne Angabe entfällt die Zeile. */
  parking?: string
}

export default function VenueMap({ lat, lng, label, address, parking }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`

  useEffect(() => {
    let cancelled = false

    import('leaflet').then((leafletModule) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const L = leafletModule.default

      // Next.js/Webpack löst Leaflets eingebaute Icon-URL-Auflösung nicht
      // auf - deaktivieren und stattdessen die lokal gehosteten PNGs aus
      // public/leaflet/ direkt angeben (nie ein externes CDN).
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      })

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>-Mitwirkende',
        maxZoom: 19,
      }).addTo(map)

      // Das Infofenster öffnet sich erst beim Tippen: offen verdeckte es den
      // Kartenausschnitt und die Zoom-Knöpfe, der Name steht direkt darunter.
      L.marker([lat, lng]).addTo(map).bindPopup(`<strong>${label}</strong><br/>${address}`)
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng, label, address])

  return (
    // isolate: Leaflet vergibt intern z-index bis 1000 - ohne eigenen
    // Stapelkontext läge die Karte über der fixen Navigation.
    <div className="isolate overflow-hidden rounded-2xl border border-champagne-dark bg-champagne-light shadow-sm">
      {/* Hinter den Kacheln liegt eine feste Karte (Ausschnitt um den Ort): blockiert
          das Netz die OpenStreetMap-Kacheln, bleibt die Fläche nicht grau. */}
      <div
        ref={containerRef}
        className="h-64 w-full bg-champagne md:h-80"
        style={{ backgroundImage: 'url(/info/karte.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h3 className="font-display text-2xl font-semibold leading-tight text-dark-blue md:text-3xl">{label}</h3>
          <p className="mt-1 text-sm text-gray-700">{address}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-bordeaux px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bordeaux-light"
          >
            <MapPin size={16} />
            Route planen
          </a>
          <SaveToCalendarButton />
        </div>

        {parking && (
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-dark-blue text-xs font-bold text-white"
            >
              P
            </span>
            {parking}
          </p>
        )}

        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-xs text-gray-600 underline underline-offset-2 hover:text-dark-blue"
        >
          Auf OpenStreetMap ansehen
        </a>
      </div>
    </div>
  )
}
