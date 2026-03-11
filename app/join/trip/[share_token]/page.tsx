'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type TripInfo = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
}

function formatDate(date: string | null) {
  if (!date) return 'TBD'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

// Generic trip invite: /join/trip/[share_token]
// Uses trips.invite_token — anyone with this link can join.
export default function JoinTripPage() {
  const { share_token } = useParams() as { share_token: string }
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()

  const [trip, setTrip]           = useState<TripInfo | null>(null)
  const [alreadyIn, setAlreadyIn] = useState(false)
  const [joining, setJoining]     = useState(false)
  const [error, setError]         = useState('')
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    async function load() {
      const { data, error: tripErr } = await supabase
        .from('trips')
        .select('id, name, destination, start_date, end_date')
        .eq('invite_token', share_token)
        .single()

      if (tripErr || !data) {
        setError('This invite link is invalid or has expired.')
        setPageLoading(false)
        return
      }

      setTrip(data)

      if (session) {
        const { data: existing } = await supabase
          .from('trip_members')
          .select('id')
          .eq('trip_id', data.id)
          .eq('user_id', session.user.id)
          .single()
        if (existing) setAlreadyIn(true)
      }

      setPageLoading(false)
    }

    load()
  }, [share_token, authLoading, session])

  async function handleJoin() {
    if (!session) {
      router.push(`/signup?next=/join/trip/${share_token}`)
      return
    }
    if (!trip) return

    setJoining(true)

    const { error: insertErr } = await supabase.from('trip_members').insert({
      trip_id:     trip.id,
      user_id:     session.user.id,
      status:      'confirmed',
      member_type: 'registered',
      invite_status: 'accepted',
    })

    if (insertErr) {
      setError(insertErr.message)
      setJoining(false)
    } else {
      router.push(`/trip/${trip.id}`)
    }
  }

  if (pageLoading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f2e1a' }}>
        <p style={{ color: '#86efac' }}>Loading…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f2e1a', padding: '0 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', maxWidth: '360px', width: '100%' }}>
          <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>
          <Link href="/" style={{ fontSize: '14px', color: '#15803d' }}>Go home</Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f2e1a', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: '#fff', borderRadius: '20px', padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b59a3c', fontWeight: 600, marginBottom: '16px' }}>
          ⛳ Golf Trip Invite
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#14532d', margin: '0 0 6px' }}>
          {trip?.name}
        </h1>
        <p style={{ fontSize: '14px', color: '#71717a', margin: '0 0 24px' }}>
          {trip?.destination ?? 'Destination TBD'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f4f4f5', borderRadius: '12px', padding: '16px', marginBottom: '28px' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '2px' }}>Start</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#3f3f46' }}>{formatDate(trip?.start_date ?? null)}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '2px' }}>End</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#3f3f46' }}>{formatDate(trip?.end_date ?? null)}</p>
          </div>
        </div>

        {alreadyIn ? (
          <Link
            href={`/trip/${trip?.id}`}
            style={{ display: 'block', background: '#15803d', color: '#fff', padding: '14px', borderRadius: '10px', textAlign: 'center', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }}
          >
            View trip →
          </Link>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{ width: '100%', background: '#15803d', color: '#fff', padding: '14px', borderRadius: '10px', border: 'none', cursor: joining ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '15px', opacity: joining ? 0.6 : 1 }}
          >
            {joining ? 'Joining…' : session ? "Join trip — I'm in" : 'Sign up to join'}
          </button>
        )}

        {!session && !alreadyIn && (
          <p style={{ fontSize: '12px', color: '#a1a1aa', textAlign: 'center', marginTop: '12px' }}>
            Already have an account?{' '}
            <Link href={`/login?next=/join/trip/${share_token}`} style={{ color: '#15803d' }}>Log in</Link>
          </p>
        )}
      </div>
    </main>
  )
}
