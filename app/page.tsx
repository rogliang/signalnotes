'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // For now, just redirect to settings
    // In Session 2, we'll create the main notes interface
    router.push('/settings')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )
}
