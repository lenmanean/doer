'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DataPageRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/analytics')
  }, [router])
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff7f00]"></div>
    </div>
  )
}
