'use client'

import { useEffect, useState } from 'react'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import AdminDashboard from '@/components/admin/AdminDashboard'

type AuthState =
  | { status: 'checking' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; locked: boolean }

async function checkAuth(): Promise<AuthState> {
  try {
    const response = await fetch('/api/admin/write-lock')
    if (!response.ok) {
      return { status: 'unauthenticated' }
    }
    const data = (await response.json()) as { locked: boolean }
    return { status: 'authenticated', locked: data.locked }
  } catch {
    return { status: 'unauthenticated' }
  }
}

export default function AdminPage() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' })

  useEffect(() => {
    checkAuth().then(setAuth)
  }, [])

  if (auth.status === 'checking') {
    // Bewusst leer statt eines Ladespinners: verhindert, dass zwischen
    // Server- und erstem Client-Render unterschiedliche Inhalte
    // gerendert werden (siehe Hydration-Lehre aus dem Memory-Spiel-Review).
    return null
  }

  if (auth.status === 'unauthenticated') {
    return <AdminLoginForm onSuccess={() => checkAuth().then(setAuth)} />
  }

  return <AdminDashboard initialLocked={auth.locked} />
}
