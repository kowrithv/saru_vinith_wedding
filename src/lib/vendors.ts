export interface Vendor {
  name: string
  /** Nur gesetzt, wenn die Rolle sicher ist (z. B. aus dem Profilnamen). */
  role?: string
  /** Profil oder Webseite, ohne Tracking-Parameter. */
  href: string
}

// Die Dienstleister des Tages, in der Reihenfolge der Brautleute. Rollen für
// Optimeye, MP Designs und Bubble BAS kommen, sobald sie feststehen.
export const vendors: Vendor[] = [
  { name: 'Optimeye', href: 'https://www.instagram.com/optimeye' },
  { name: 'MP Designs', href: 'https://www.instagram.com/mp_designs' },
  { name: 'Nandys', role: 'Catering', href: 'https://www.instagram.com/nandys_catering' },
  { name: 'DJ Tastic', role: 'DJ', href: 'https://www.instagram.com/djtastic_de' },
  { name: 'Bubble BAS', href: 'https://www.instagram.com/__bubblebas__' },
  {
    name: 'Begegnungsstätte Niederkrüchten',
    role: 'Location',
    href: 'https://www.reservierungen-niederkruechten.de/begegnungsstaette.html',
  },
]
