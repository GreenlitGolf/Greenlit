'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function DashboardPage() {
  const { session } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col items-center justify-center bg-green-950 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-green-950">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-zinc-500">Logged in as:</p>
          <p className="font-medium">{session?.user.email}</p>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Log out
          </button>
        </div>
      </main>
    </ProtectedRoute>
  )
}
