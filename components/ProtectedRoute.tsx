'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.push('/login')
    }
  }, [session, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-950">
        <p className="text-green-300">Loading...</p>
      </div>
    )
  }

  if (!session) return null

  return <>{children}</>
}
