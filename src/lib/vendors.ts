export interface Vendor {
  name: string
  /** Was der Dienstleister macht; ohne Angabe steht stattdessen die Art des Links. */
  role?: string
  /** Profil oder Webseite, ohne Tracking-Parameter. */
  href: string
}

// Die Dienstleister des Tages, in der Reihenfolge der Brautleute.
export const vendors: Vendor[] = [
  { name: 'Optimeye', role: 'Fotografie', href: 'https://www.instagram.com/optimeye' },
  { name: 'MP Designs', role: 'Dekoration', href: 'https://www.instagram.com/mp_designs' },
  { name: 'Nandys', role: 'Catering', href: 'https://www.instagram.com/nandys_catering' },
  { name: 'DJ Tastic', role: 'DJ', href: 'https://www.instagram.com/djtastic_de' },
  { name: 'Bubble BAS', role: 'Bubble Tea', href: 'https://www.instagram.com/__bubblebas__' },
  {
    name: 'Begegnungsstätte Niederkrüchten',
    role: 'Location',
    href: 'https://www.reservierungen-niederkruechten.de/begegnungsstaette.html',
  },
]
