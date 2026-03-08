'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import InviteForm from '@/components/InviteForm'
import EditTripForm from '@/components/EditTripForm'

type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  invite_token: string
  created_by: string
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
  const { session } = useAuth()
  const router = useRouter()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)

  const isOrganizer = trip?.created_by === session?.user.id

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

  async function handleRemoveMember(userId: string) {
    await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', id)
      .eq('user_id', userId)

    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
  }

  async function handleLeaveTrip() {
    if (!session) return
    await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', id)
      .eq('user_id', session.user.id)

    router.push('/dashboard')
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-green-950 px-4 py-12">
        <div className="mx-auto w-full max-w-sm space-y-6">

          {loading && <p className="text-center text-green-300">Loading...</p>}
          {error && <p className="text-center text-red-400">{error}</p>}

          {trip && (
            <div className="space-y-4 rounded-2xl bg-white p-8">

              {editing ? (
                <EditTripForm
                  trip={trip}
                  onSave={(updated) => { setTrip({ ...trip, ...updated }); setEditing(false) }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-green-700">Trip</p>
                      <h1 className="text-2xl font-bold text-green-950">{trip.name}</h1>
                      <p className="text-sm text-zinc-500">{trip.destination ?? 'Destination TBD'}</p>
                    </div>
                    {isOrganizer && (
                      <button
                        onClick={() => setEditing(true)}
                        className="text-sm text-green-700 hover:underline"
                      >
                        Edit
                      </button>
                    )}
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
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                              {m.status}
                            </span>
                            {isOrganizer && m.user_id !== session?.user.id && (
                              <button
                                onClick={() => handleRemoveMember(m.user_id)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                Remove
                              </button>
                            )}
                          </div>
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

                  <div className="space-y-2 border-t border-zinc-100 pt-4">
                    {!isOrganizer && (
                      <button
                        onClick={handleLeaveTrip}
                        className="w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
                      >
                        Leave trip
                      </button>
                    )}
                    <Link
                      href="/dashboard"
                      className="block text-center text-sm text-green-700 hover:underline"
                    >
                      ← Back to dashboard
                    </Link>
                  </div>
                </>
              )}

            </div>
          )}

        </div>
      </main>
    </ProtectedRoute>
  )
}
