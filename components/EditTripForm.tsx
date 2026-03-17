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

const today = () => new Date().toISOString().split('T')[0]

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
  boxSizing:    'border-box' as const,
  transition:   'border-color 0.2s, box-shadow 0.2s',
}

const errorStyle: React.CSSProperties = {
  fontSize:   '12px',
  color:      '#c0392b',
  marginTop:  '4px',
  fontFamily: 'var(--font-sans)',
  fontWeight: 300,
}

export default function EditTripForm({ trip, onSave, onCancel }: Props) {
  const [name, setName]           = useState(trip.name)
  const [destination, setDestination] = useState(trip.destination ?? '')
  const [startDate, setStartDate] = useState(trip.start_date ?? '')
  const [endDate, setEndDate]     = useState(trip.end_date ?? '')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  // Validation
  const startError = startDate && startDate < today() ? 'Start date cannot be in the past.' : ''
  const endError   = startDate && endDate && endDate < startDate ? 'End date must be after start date.' : ''
  const hasErrors  = !!startError || !!endError || !name.trim()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (hasErrors) return
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
    /* Backdrop */
    <div
      onClick={onCancel}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.55)',
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px',
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding:      '36px',
          width:        '100%',
          maxWidth:     '440px',
          boxShadow:    '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '6px' }}>
              Edit Trip
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--green-deep)', lineHeight: 1.2 }}>
              Trip Details
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-light)', lineHeight: 1, padding: '0 0 0 12px' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Trip name */}
          <div>
            <label style={labelStyle}>
              Trip Name <span style={{ color: 'var(--gold)', marginLeft: '2px' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputBase}
            />
          </div>

          {/* Destination */}
          <div>
            <label style={labelStyle}>Destination</label>
            <input
              type="text"
              placeholder="Deciding soon…"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={inputBase}
            />
          </div>

          {/* Dates */}
          <div>
            <label style={labelStyle}>Travel Dates</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '6px', fontFamily: 'var(--font-sans)', fontWeight: 300 }}>
                  Start
                </div>
                <input
                  type="date"
                  value={startDate}
                  min={today()}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (endDate && e.target.value && endDate < e.target.value) setEndDate('')
                  }}
                  style={{ ...inputBase, borderColor: startError ? '#c0392b' : undefined }}
                />
                {startError && <div style={errorStyle}>{startError}</div>}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '6px', fontFamily: 'var(--font-sans)', fontWeight: 300 }}>
                  End
                </div>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || today()}
                  disabled={!startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ ...inputBase, borderColor: endError ? '#c0392b' : undefined, opacity: !startDate ? 0.5 : 1 }}
                />
                {endError && <div style={errorStyle}>{endError}</div>}
              </div>
            </div>
          </div>

          {/* General error */}
          {error && <p style={{ ...errorStyle, margin: 0 }}>{error}</p>}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, padding: '13px 16px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--cream-dark)', background: 'var(--cream)',
                fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                color: 'var(--text-light)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || hasErrors}
              style={{
                flex: 2, padding: '13px 16px', borderRadius: 'var(--radius-md)',
                border: 'none',
                background: loading || hasErrors ? 'var(--cream-dark)' : 'var(--green-deep)',
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: loading || hasErrors ? 'var(--text-light)' : 'var(--gold-light)',
                cursor: loading || hasErrors ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
              }}
            >
              {loading ? 'Saving…' : 'Save Changes →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
