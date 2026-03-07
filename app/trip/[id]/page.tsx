'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'

type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
}

function formatDate(date: string | null) {
  if (!date) return 'TBD'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function TripPage() {
  const { id } = useParams()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchTrip() {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setError('Trip not found.')
      } else {
        setTrip(data)
      }
      setLoading(false)
    }

    if (id) fetchTrip()
  }, [id])

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen items-center justify-center bg-green-950">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8">
          {loading && <p className="text-sm text-zinc-500">Loading...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {trip && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-green-700">Trip</p>
                <h1 className="text-2xl font-bold text-green-950">{trip.name}</h1>
                <p className="text-sm text-zinc-500">
                  {trip.destination ?? 'Destination TBD'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-4">
                <div>
                  <p className="text-xs text-zinc-400">Start</p>
                  <p className="text-sm font-medium text-zinc-700">{formatDate(trip.start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">End</p>
                  <p className="text-sm font-medium text-zinc-700">{formatDate(trip.end_date)}</p>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="block text-center text-sm text-green-700 hover:underline"
              >
                ← Back to dashboard
              </Link>
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  )
}
