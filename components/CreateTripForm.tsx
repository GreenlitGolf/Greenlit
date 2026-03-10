'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const GOLFER_OPTIONS = ['2', '3', '4', '5', '6', '7', '8+']

const inputBase: React.CSSProperties = {
  width:        '100%',
  padding:      '13px 16px',
  borderRadius: 'var(--radius-md)',
  border:       '1.5px solid var(--cream-dark)',
  background:   'var(--cream)',
  fontSize:     '14px',
  fontFamily:   'var(--font-sans)',
  fontWeight:   300,
  color:        'var(--text-dark)',
  outline:      'none',
  boxSizing:    'border-box',
  transition:   'border-color 0.2s, box-shadow 0.2s',
}

const inputFocus: React.CSSProperties = {
  borderColor: 'var(--gold)',
  boxShadow:   '0 0 0 3px rgba(196,168,79,0.12)',
  background:  'var(--white)',
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '10px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight:    600,
  color:         'var(--green-mid)',
  marginBottom:  '8px',
  fontFamily:    'var(--font-sans)',
}

export default function CreateTripForm() {
  const { session } = useAuth()
  const router = useRouter()

  const [name,      setName]      = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [golfers,   setGolfers]   = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [focused,   setFocused]   = useState<string | null>(null)

  function fieldStyle(id: string): React.CSSProperties {
    return focused === id ? { ...inputBase, ...inputFocus } : inputBase
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setLoading(true)
    setError('')

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        name,
        destination: null,
        start_date:  startDate || null,
        end_date:    endDate   || null,
        created_by:  session.user.id,
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
        status:  'confirmed',
      })

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    router.push(`/trip/${trip.id}`)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Trip name */}
      <div>
        <label htmlFor="trip-name" style={labelStyle}>
          Trip Name <span style={{ color: 'var(--gold)', marginLeft: '2px' }}>*</span>
        </label>
        <input
          id="trip-name"
          type="text"
          required
          placeholder="Pebble Beach 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused('name')}
          onBlur={() => setFocused(null)}
          style={fieldStyle('name')}
        />
      </div>

      {/* Travel dates */}
      <div>
        <label style={labelStyle}>Travel Dates</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div
              style={{
                fontSize:     '11px',
                color:        'var(--text-light)',
                marginBottom: '6px',
                fontFamily:   'var(--font-sans)',
                fontWeight:   300,
              }}
            >
              Start
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onFocus={() => setFocused('start')}
              onBlur={() => setFocused(null)}
              style={fieldStyle('start')}
            />
          </div>
          <div>
            <div
              style={{
                fontSize:     '11px',
                color:        'var(--text-light)',
                marginBottom: '6px',
                fontFamily:   'var(--font-sans)',
                fontWeight:   300,
              }}
            >
              End
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onFocus={() => setFocused('end')}
              onBlur={() => setFocused(null)}
              style={fieldStyle('end')}
            />
          </div>
        </div>
      </div>

      {/* Number of golfers */}
      <div>
        <label htmlFor="golfers" style={labelStyle}>Number of Golfers</label>
        <div style={{ position: 'relative' }}>
          <select
            id="golfers"
            value={golfers}
            onChange={(e) => setGolfers(e.target.value)}
            onFocus={() => setFocused('golfers')}
            onBlur={() => setFocused(null)}
            style={{
              ...fieldStyle('golfers'),
              appearance:    'none',
              paddingRight:  '40px',
              cursor:        'pointer',
              color:         golfers ? 'var(--text-dark)' : 'var(--text-light)',
            }}
          >
            <option value="" disabled>Select group size…</option>
            {GOLFER_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} golfers</option>
            ))}
          </select>
          {/* Chevron */}
          <div
            aria-hidden
            style={{
              position:       'absolute',
              right:          '14px',
              top:            '50%',
              transform:      'translateY(-50%)',
              pointerEvents:  'none',
              color:          'var(--green-muted)',
              fontSize:       '11px',
            }}
          >
            ▾
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p
          style={{
            fontSize:   '13px',
            color:      '#c0392b',
            fontFamily: 'var(--font-sans)',
            fontWeight: 300,
            margin:     0,
          }}
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        style={{
          width:         '100%',
          padding:       '15px 24px',
          borderRadius:  'var(--radius-md)',
          background:    loading || !name.trim() ? 'var(--cream-dark)' : 'var(--green-deep)',
          color:         loading || !name.trim() ? 'var(--text-light)' : 'var(--gold-light)',
          fontSize:      '13px',
          fontWeight:    600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily:    'var(--font-sans)',
          border:        'none',
          cursor:        loading || !name.trim() ? 'default' : 'pointer',
          transition:    'all 0.2s',
          marginTop:     '4px',
        }}
      >
        {loading ? 'Creating…' : 'Create Trip →'}
      </button>

    </form>
  )
}
