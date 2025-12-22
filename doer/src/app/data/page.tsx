'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DataPageRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/analytics')
  }, [router])
  
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
    </div>
  )
}
