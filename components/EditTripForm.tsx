'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
}

type Props = {
  trip: Trip
  onSave: (updated: Trip) => void
  onCancel: () => void
}

export default function EditTripForm({ trip, onSave, onCancel }: Props) {
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState(trip.destination ?? '')
  const [startDate, setStartDate] = useState(trip.start_date ?? '')
  const [endDate, setEndDate] = useState(trip.end_date ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('trips')
      .update({
        name,
        destination: destination || null,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .eq('id', trip.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      onSave(data)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700">
          Trip name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-green-700 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
