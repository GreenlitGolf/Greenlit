'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
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

export default function JoinPage() {
  const { token } = useParams()
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    async function fetchTrip() {
      const { data, error } = await supabase
        .from('trips')
        .select('id, name, destination, start_date, end_date')
        .eq('invite_token', token)
        .single()

      if (error || !data) {
        setError('This invite link is invalid or has expired.')
        setPageLoading(false)
        return
      }

      setTrip(data)

      const { data: memberRows } = await supabase
        .from('trip_members')
        .select('user_id, status')
        .eq('trip_id', data.id)

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
        if (session) {
          setAlreadyMember(memberRows.some((m) => m.user_id === session.user.id))
        }
      }

      setPageLoading(false)
    }

    if (!authLoading) fetchTrip()
  }, [token, authLoading, session])

  async function handleAccept() {
    if (!session) {
      router.push(`/signup?next=/join/${token}`)
      return
    }

    setJoining(true)

    const { error } = await supabase.from('trip_members').insert({
      trip_id: trip!.id,
      user_id: session.user.id,
      status: 'confirmed',
    })

    if (error) {
      setError(error.message)
      setJoining(false)
    } else {
      router.push(`/trip/${trip!.id}`)
    }
  }

  if (pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-green-950">
        <p className="text-green-300">Loading...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-green-950">
        <div className="rounded-2xl bg-white p-8 text-center">
          <p className="text-red-500">{error}</p>
          <Link href="/" className="mt-4 block text-sm text-green-700 hover:underline">
            Go home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-green-950 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">
            You&apos;re invited
          </p>
          <h1 className="text-2xl font-bold text-green-950">{trip?.name}</h1>
          <p className="text-sm text-zinc-500">{trip?.destination ?? 'Destination TBD'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-4">
          <div>
            <p className="text-xs text-zinc-400">Start</p>
            <p className="text-sm font-medium text-zinc-700">{formatDate(trip?.start_date ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">End</p>
            <p className="text-sm font-medium text-zinc-700">{formatDate(trip?.end_date ?? null)}</p>
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

        {alreadyMember ? (
          <Link
            href={`/trip/${trip?.id}`}
            className="block w-full rounded-lg bg-green-700 py-2 text-center text-sm font-medium text-white hover:bg-green-800"
          >
            View trip
          </Link>
        ) : (
          <button
            onClick={handleAccept}
            disabled={joining}
            className="w-full rounded-lg bg-green-700 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {joining ? 'Joining...' : session ? 'Accept invite' : 'Sign up to join'}
          </button>
        )}
      </div>
    </main>
  )
}
