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

type MemberInfo = {
  id: number
  display_name: string | null
  email: string | null
  member_type: string
  invite_status: string
}

function formatDate(date: string | null) {
  if (!date) return 'TBD'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

// Member-specific invite link: /join/[invite_token]
export default function JoinPage() {
  const { token } = useParams() as { token: string }
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()

  const [trip, setTrip]         = useState<TripInfo | null>(null)
  const [member, setMember]     = useState<MemberInfo | null>(null)
  const [alreadyIn, setAlreadyIn] = useState(false)
  const [joining, setJoining]   = useState(false)
  const [error, setError]       = useState('')
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    async function load() {
      // Look up member-specific invite token
      const { data: memberRow, error: memberErr } = await supabase
        .from('trip_members')
        .select('id, display_name, email, member_type, invite_status, trip_id')
        .eq('invite_token', token)
        .single()

      if (memberErr || !memberRow) {
        // Fall back: check trips.invite_token (legacy generic links)
        const { data: tripRow, error: tripErr } = await supabase
          .from('trips')
          .select('id, name, destination, start_date, end_date')
          .eq('invite_token', token)
          .single()

        if (tripErr || !tripRow) {
          setError('This invite link is invalid or has expired.')
          setPageLoading(false)
          return
        }

        // Redirect to generic join page (pass the token itself, not the id)
        router.replace(`/join/trip/${token}`)
        return
      }

      // Fetch trip info
      const { data: tripData } = await supabase
        .from('trips')
        .select('id, name, destination, start_date, end_date')
        .eq('id', memberRow.trip_id)
        .single()

      setMember(memberRow as MemberInfo)
      setTrip(tripData)

      // Check if already accepted
      if (memberRow.invite_status === 'accepted' && memberRow.member_type === 'registered') {
        setAlreadyIn(true)
      }
      // If logged in, check if this user is the ghost member being claimed
      if (session && memberRow.member_type === 'ghost') {
        // Already a member of this trip with their real account?
        const { data: existing } = await supabase
          .from('trip_members')
          .select('id')
          .eq('trip_id', memberRow.trip_id)
          .eq('user_id', session.user.id)
          .single()
        if (existing) setAlreadyIn(true)
      }

      setPageLoading(false)
    }

    load()
  }, [token, authLoading, session, router])

  async function handleAccept() {
    if (!session) {
      router.push(`/signup?next=/join/${token}`)
      return
    }
    if (!trip || !member) return

    setJoining(true)

    // Claim the ghost member slot: update user_id + mark accepted
    const { error: updateErr } = await supabase
      .from('trip_members')
      .update({
        user_id:      session.user.id,
        member_type:  'registered',
        invite_status: 'accepted',
        status:       'confirmed',
      })
      .eq('id', member.id)

    if (updateErr) {
      // Ghost slot already taken — insert fresh
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
        return
      }
    }

    router.push(`/trip/${trip.id}`)
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

        {member?.display_name && (
          <p style={{ fontSize: '14px', color: '#71717a', marginBottom: '4px' }}>
            Hey {member.display_name} —
          </p>
        )}

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
            onClick={handleAccept}
            disabled={joining}
            style={{ width: '100%', background: '#15803d', color: '#fff', padding: '14px', borderRadius: '10px', border: 'none', cursor: joining ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '15px', opacity: joining ? 0.6 : 1 }}
          >
            {joining ? 'Joining…' : session ? "Accept invite — I'm in" : 'Sign up to accept'}
          </button>
        )}

        {!session && !alreadyIn && (
          <p style={{ fontSize: '12px', color: '#a1a1aa', textAlign: 'center', marginTop: '12px' }}>
            Already have an account?{' '}
            <Link href={`/login?next=/join/${token}`} style={{ color: '#15803d' }}>Log in</Link>
          </p>
        )}
      </div>
    </main>
  )
}
