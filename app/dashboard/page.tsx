'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Dates TBD'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

export default function DashboardPage() {
  const { session } = useAuth()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTrips() {
      if (!session) return

      const { data: memberRows } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', session.user.id)

      if (memberRows && memberRows.length > 0) {
        const tripIds = memberRows.map((r) => r.trip_id)
        const { data: tripData } = await supabase
          .from('trips')
          .select('id, name, destination, start_date, end_date')
          .in('id', tripIds)
        if (tripData) setTrips(tripData)
      }

      setLoading(false)
    }

    fetchTrips()
  }, [session])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-green-950 px-4 py-12">
        <div className="mx-auto w-full max-w-md space-y-6">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Your trips</h1>
              <p className="text-sm text-green-300">{session?.user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-green-300 hover:text-white"
            >
              Log out
            </button>
          </div>

          <Link
            href="/trips/new"
            className="flex w-full items-center justify-center rounded-xl bg-green-700 py-3 text-sm font-medium text-white hover:bg-green-600"
          >
            + New trip
          </Link>

          {loading && (
            <p className="text-center text-sm text-green-300">Loading trips...</p>
          )}

          {!loading && trips.length === 0 && (
            <p className="text-center text-sm text-green-300">
              No trips yet — create your first one above.
            </p>
          )}

          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trip/${trip.id}`}
              className="block rounded-xl bg-white p-5 hover:bg-zinc-50"
            >
              <p className="font-semibold text-green-950">{trip.name}</p>
              <p className="text-sm text-zinc-500">{trip.destination ?? 'Destination TBD'}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {formatDateRange(trip.start_date, trip.end_date)}
              </p>
            </Link>
          ))}

        </div>
      </main>
    </ProtectedRoute>
  )
}
