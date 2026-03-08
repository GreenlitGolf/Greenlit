'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import InviteForm from '@/components/InviteForm'

type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  invite_token: string
}

type Member = {
  user_id: string
  status: string
  users: { full_name: string | null; email: string } | null
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
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchTrip() {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setError('Trip not found.')
        setLoading(false)
        return
      }

      setTrip(data)

      const { data: memberRows } = await supabase
        .from('trip_members')
        .select('user_id, status')
        .eq('trip_id', id)

      if (memberRows && memberRows.length > 0) {
        const userIds = memberRows.map((m) => m.user_id)
        const { data: userData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', userIds)

        const merged = memberRows.map((m) => ({
          ...m,
          users: userData?.find((u) => u.id === m.user_id) ?? null,
        }))
        setMembers(merged)
      }
      setLoading(false)
    }

    if (id) fetchTrip()
  }, [id])

  function copyInviteLink() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    navigator.clipboard.writeText(`${baseUrl}/join/${trip?.invite_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-green-950 px-4 py-12">
        <div className="mx-auto w-full max-w-sm space-y-6">

          {loading && <p className="text-center text-green-300">Loading...</p>}
          {error && <p className="text-center text-red-400">{error}</p>}

          {trip && (
            <div className="space-y-4 rounded-2xl bg-white p-8">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-green-700">Trip</p>
                <h1 className="text-2xl font-bold text-green-950">{trip.name}</h1>
                <p className="text-sm text-zinc-500">{trip.destination ?? 'Destination TBD'}</p>
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

              {members.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Members</p>
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between">
                      <p className="text-sm text-zinc-700">
                        {m.users?.full_name ?? m.users?.email ?? 'Unknown'}
                      </p>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Invite link</p>
                <button
                  onClick={copyInviteLink}
                  className="w-full rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {copied ? 'Copied!' : 'Copy invite link'}
                </button>
              </div>

              <InviteForm tripId={trip.id} />

              <Link
                href="/dashboard"
                className="block text-center text-sm text-green-700 hover:underline"
              >
                ← Back to dashboard
              </Link>
            </div>
          )}

        </div>
      </main>
    </ProtectedRoute>
  )
}
