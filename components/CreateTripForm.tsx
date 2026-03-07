'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export default function CreateTripForm() {
  const { session } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setLoading(true)
    setError('')

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        name,
        destination: destination || null,
        start_date: startDate || null,
        end_date: endDate || null,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (tripError) {
      setError(tripError.message)
      setLoading(false)
      return
    }

    const { error: memberError } = await supabase
      .from('trip_members')
      .insert({
        trip_id: trip.id,
        user_id: session.user.id,
        status: 'confirmed',
      })

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    router.push(`/trip/${trip.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700">
          Trip name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          placeholder="Pebble Beach 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700">Destination</label>
        <input
          type="text"
          placeholder="Deciding soon…"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-green-700 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {loading ? 'Creating trip...' : 'Create trip'}
      </button>
    </form>
  )
}
