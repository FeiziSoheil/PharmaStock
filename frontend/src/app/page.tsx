'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/api/session'

/**
 * App entry: no design-system hub.
 * Authenticated users land on the dashboard; others go to login.
 */
export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login')
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-body-md text-text-secondary">
      در حال انتقال…
    </main>
  )
}
