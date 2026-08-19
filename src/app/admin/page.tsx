import { cookies } from 'next/headers'
import { ADMIN_COOKIE_NAME, isValidSession } from '@/lib/admin-auth'
import { readSettings } from '@/lib/site-settings'
import AdminLoginForm from '@/components/admin/AdminLoginForm'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const isAuthenticated = isValidSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value)

  if (!isAuthenticated) {
    return <AdminLoginForm />
  }

  const settings = await readSettings()
  return <AdminDashboard initialSettings={settings} />
}
