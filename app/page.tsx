'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to notes (main interface)
    router.push('/notes')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )
}
