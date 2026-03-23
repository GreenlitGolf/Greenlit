'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/ui/Sidebar'
import type { NavItem } from '@/components/ui/Sidebar'
import { syncAccommodationToItinerary, removeAccommodationFromItinerary } from '@/lib/syncItinerary'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id:          string
  name:        string
  destination: string | null
  start_date:  string | null
  end_date:    string | null
  created_by:  string
}

type Accommodation = {
  id:                  string
  trip_id:             string
  name:                string
  address:             string | null
  phone:               string | null
  website_url:         string | null
  check_in_date:       string   // YYYY-MM-DD
  check_out_date:      string   // YYYY-MM-DD
  check_in_time:       string   // HH:MM or HH:MM:SS
  check_out_time:      string   // HH:MM or HH:MM:SS
  confirmation_number: string | null
  num_rooms:           number | null
  cost_per_night:      number | null
  total_cost:          number | null
  notes:               string | null
  added_by:            string | null
  created_at:          string
}

type LodgingSuggestion = {
  courseName:  string
  type:        'on_property' | 'nearby'
  name:        string
  description: string | null
}

type FormState = {
  id?:                 string
  name:                string
  address:             string
  phone:               string
  website_url:         string
  check_in_date:       string
  check_out_date:      string
  check_in_time:       string
  check_out_time:      string
  confirmation_number: string
  num_rooms:           string
  cost_per_night:      string
  total_cost:          string
  notes:               string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  name: '', address: '', phone: '', website_url: '',
  check_in_date: '', check_out_date: '',
  check_in_time: '15:00', check_out_time: '11:00',
  confirmation_number: '', num_rooms: '',
  cost_per_night: '', total_cost: '', notes: '',
}

const BAR_COLORS = [
  '#2d5a3d', '#4a7c4a', '#6b8c4a', '#c4a84f',
  '#7a8fa6', '#8b5e3c', '#4a6b7c', '#6b4a7c',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime())
    / (1000 * 60 * 60 * 24)
  )
}

function formatTime12(s: string): string {
  const [hStr, mStr] = s.split(':')
  const h      = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12    = h % 12 || 12
  return `${h12}:${mStr} ${period}`
}

function formatDateMed(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  })
}

function getTripDays(start: string | null, end: string | null): string[] {
  if (!start) return []
  const s   = new Date(start + 'T12:00:00')
  const e   = end ? new Date(end + 'T12:00:00') : s
  const out: string[] = []
  const cur = new Date(s)
  while (cur <= e) {
    out.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function buildTripMeta(start: string | null, end: string | null, count: number): string {
  const parts: string[] = []
  if (start) {
    const s = new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = end ? new Date(end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
    parts.push(e ? `${s} – ${e}` : `From ${s}`)
  }
  if (count > 0) parts.push(`${count} golfer${count !== 1 ? 's' : ''}`)
  return parts.join(' · ')
}

function buildNavItems(memberCount: number): NavItem[] {
  return [
    { id: 'concierge', icon: '✦',  label: 'Golf Concierge',  href: '' },
    { id: 'itinerary', icon: '📅', label: 'Trip Itinerary',  href: '' },
    { id: 'games',     icon: '🎲', label: 'Golf Games',      href: '' },
    { id: 'teetimes',  icon: '🕐', label: 'Tee Times',       href: '' },
    { id: 'report',    icon: '📄', label: 'Trip Report',     href: '' },
    { id: 'hotels',    icon: '🏨', label: 'Accommodations',  href: '' },
    { id: 'group',     icon: '👥', label: 'Group & Members', href: '', badge: memberCount > 0 ? memberCount : undefined },
    { id: 'budget',    icon: '💰', label: 'Budget Tracker',  href: '' },
  ]
}

function getCountdown(dateStr: string): string | null {
  const now      = new Date()
  const target   = new Date(dateStr + 'T12:00:00')
  const diffMs   = target.getTime() - now.getTime()
  if (diffMs < 0) return null
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 7) return null
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `In ${diffDays} days`
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--cream-dark)', background: 'var(--cream)',
  fontSize: '14px', color: 'var(--text-dark)', fontFamily: 'var(--font-sans)',
  fontWeight: 300, outline: 'none', width: '100%', boxSizing: 'border-box',
}

const labelSt: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--text-mid)', fontFamily: 'var(--font-sans)',
}

const sectionLabelSt: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
  textTransform: 'uppercase', color: 'var(--text-light)', fontFamily: 'var(--font-sans)',
  marginBottom: '8px',
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function SummaryBar({ accs }: { accs: Accommodation[] }) {
  const totalNights = accs.reduce((sum, a) => sum + daysBetween(a.check_in_date, a.check_out_date), 0)
  const totalCost   = accs.reduce((sum, a) => {
    const n = daysBetween(a.check_in_date, a.check_out_date)
    const v = a.total_cost ?? (a.cost_per_night != null && n > 0 ? a.cost_per_night * n : null)
    return sum + (v ?? 0)
  }, 0)

  const now      = new Date()
  const upcoming = [...accs]
    .filter(a => new Date(a.check_in_date + 'T' + a.check_in_time) > now)
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date))
  const next = upcoming[0] ?? null

  const stats = [
    {
      label: 'Properties',
      value: String(accs.length),
      sub:   `${totalNights} night${totalNights !== 1 ? 's' : ''} total`,
    },
    {
      label: 'Total Lodging',
      value: totalCost > 0 ? formatMoney(totalCost) : '—',
      sub:   totalCost > 0 ? 'across all stays' : 'no costs logged yet',
    },
    {
      label: 'Next Check-in',
      value: next ? formatDateMed(next.check_in_date) : '—',
      sub:   next
        ? (getCountdown(next.check_in_date) ?? formatTime12(next.check_in_time))
        : 'no upcoming stays',
    },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1px', background: 'var(--cream-dark)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      border: '1px solid var(--cream-dark)', marginBottom: '32px',
    }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: 'var(--white)', padding: '20px 24px' }}>
          <div style={{ ...sectionLabelSt, marginBottom: '6px' }}>{s.label}</div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '26px',
            color: 'var(--green-deep)', fontWeight: 600, marginBottom: '2px',
          }}>
            {s.value}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Stay Timeline ────────────────────────────────────────────────────────────

function StayTimeline({
  accs, tripStart, tripEnd, onAccClick,
}: {
  accs:        Accommodation[]
  tripStart:   string
  tripEnd:     string
  onAccClick:  (id: string) => void
}) {
  const totalDays = Math.max(1, daysBetween(tripStart, tripEnd))
  const tripDays  = getTripDays(tripStart, tripEnd)

  // Date markers — every 1 day ≤7, every 2 ≤14, every 3 otherwise
  const step    = totalDays <= 7 ? 1 : totalDays <= 14 ? 2 : 3
  const markers = tripDays.filter((_, i) => i % step === 0)
  if (markers[markers.length - 1] !== tripEnd) markers.push(tripEnd)

  return (
    <div style={{
      background: 'var(--white)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--cream-dark)', padding: '20px 24px 18px',
      marginBottom: '28px',
    }}>
      <div style={{ ...sectionLabelSt }}>Stay Timeline</div>

      <div style={{ position: 'relative' }}>
        {/* Date labels */}
        <div style={{ position: 'relative', height: '20px', marginBottom: '6px' }}>
          {markers.map((dateStr, i) => {
            const frac = daysBetween(tripStart, dateStr) / totalDays
            const pct  = Math.min(100, Math.max(0, frac * 100))
            const isLast = i === markers.length - 1
            return (
              <div
                key={dateStr}
                style={{
                  position: 'absolute', left: `${pct}%`,
                  fontSize: '10px', color: 'var(--text-light)',
                  fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  transform: isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {formatDateMed(dateStr)}
              </div>
            )
          })}
        </div>

        {/* Grid lines */}
        <div style={{ position: 'relative' }}>
          {markers.map(dateStr => {
            const frac = daysBetween(tripStart, dateStr) / totalDays
            const pct  = Math.min(100, Math.max(0, frac * 100))
            return (
              <div key={dateStr} style={{
                position: 'absolute', left: `${pct}%`, top: 0, bottom: 0,
                width: '1px', background: 'var(--cream-dark)',
                pointerEvents: 'none',
              }} />
            )
          })}

          {/* Accommodation bars */}
          {accs.map((acc, i) => {
            const startFrac = Math.max(0, daysBetween(tripStart, acc.check_in_date) / totalDays)
            const endFrac   = Math.min(1, daysBetween(tripStart, acc.check_out_date) / totalDays)
            const width     = Math.max(0.035, endFrac - startFrac)
            const color     = BAR_COLORS[i % BAR_COLORS.length]

            return (
              <div
                key={acc.id}
                style={{ position: 'relative', height: '38px', marginBottom: '5px' }}
              >
                <button
                  onClick={() => onAccClick(acc.id)}
                  title={`${acc.name} · ${formatDateMed(acc.check_in_date)} – ${formatDateMed(acc.check_out_date)}`}
                  style={{
                    position: 'absolute',
                    left: `${startFrac * 100}%`,
                    width: `${width * 100}%`,
                    top: 2, height: 32,
                    background: color,
                    borderRadius: '7px',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    paddingLeft: '10px', paddingRight: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    transition: 'filter 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                >
                  <span style={{
                    fontSize: '12px', color: 'rgba(255,255,255,0.92)',
                    fontFamily: 'var(--font-sans)', fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: 1,
                  }}>
                    {acc.name}
                  </span>
                </button>
              </div>
            )
          })}

          {/* Bottom baseline */}
          <div style={{
            height: '1px', background: 'var(--cream-dark)',
            marginTop: accs.length === 0 ? '40px' : '2px',
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── Accommodation Card ───────────────────────────────────────────────────────

function AccommodationCard({
  acc, isOrganizer, onEdit, onDelete, cardRef,
}: {
  acc:         Accommodation
  isOrganizer: boolean
  onEdit:      (a: Accommodation) => void
  onDelete:    (a: Accommodation) => void
  cardRef?:    React.RefObject<HTMLDivElement | null>
}) {
  const [copied,     setCopied]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const nights      = daysBetween(acc.check_in_date, acc.check_out_date)
  const effectiveCost = acc.total_cost
    ?? (acc.cost_per_night != null && nights > 0 ? acc.cost_per_night * nights : null)

  function copyConf() {
    if (!acc.confirmation_number) return
    navigator.clipboard.writeText(acc.confirmation_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      ref={cardRef as React.RefObject<HTMLDivElement>}
      id={`acc-${acc.id}`}
      style={{
        background: 'var(--white)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--cream-dark)', padding: '22px 24px',
        scrollMarginTop: '80px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '20px',
            color: 'var(--green-deep)', fontWeight: 600, marginBottom: '4px',
          }}>
            {acc.name}
          </div>
          {acc.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-mid)', fontFamily: 'var(--font-sans)' }}>
                {acc.address}
              </span>
              <a
                href={mapsUrl(acc.address)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: 'var(--green-light)', textDecoration: 'none', fontFamily: 'var(--font-sans)', fontWeight: 500, flexShrink: 0 }}
              >
                Map →
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        {isOrganizer && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {!confirmDel ? (
              <>
                <button
                  onClick={() => onEdit(acc)}
                  style={{
                    background: 'none', border: '1px solid var(--cream-dark)',
                    borderRadius: 'var(--radius-sm)', padding: '6px 14px',
                    fontSize: '12px', color: 'var(--text-mid)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDel(true)}
                  style={{
                    background: 'none', border: '1px solid rgba(192,57,43,0.2)',
                    borderRadius: 'var(--radius-sm)', padding: '6px 14px',
                    fontSize: '12px', color: '#c0392b', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onDelete(acc)}
                  style={{
                    background: '#c0392b', border: 'none',
                    borderRadius: 'var(--radius-sm)', padding: '6px 14px',
                    fontSize: '12px', color: '#fff', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontWeight: 600,
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  style={{
                    background: 'none', border: '1px solid var(--cream-dark)',
                    borderRadius: 'var(--radius-sm)', padding: '6px 14px',
                    fontSize: '12px', color: 'var(--text-light)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--cream-dark)', marginBottom: '16px' }} />

      {/* Check-in / Check-out grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        {[
          { label: 'Check-in',  date: acc.check_in_date,  time: acc.check_in_time  },
          { label: 'Check-out', date: acc.check_out_date, time: acc.check_out_time },
        ].map(({ label, date, time }) => (
          <div key={label} style={{
            background: 'var(--cream)', borderRadius: 'var(--radius-md)', padding: '12px 14px',
          }}>
            <div style={{ ...sectionLabelSt, marginBottom: '5px' }}>{label}</div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '15px',
              color: 'var(--green-deep)', fontWeight: 600, marginBottom: '1px',
            }}>
              {formatDateLong(date)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>
              {formatTime12(time)}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation # */}
      {acc.confirmation_number && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-sans)' }}>
            Conf #
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-dark)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            {acc.confirmation_number}
          </span>
          <button
            onClick={copyConf}
            title="Copy"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px',
              fontSize: '13px', color: copied ? 'var(--green-light)' : 'var(--text-light)',
              transition: 'color 0.15s',
            }}
          >
            {copied ? '✓' : '⧉'}
          </button>
        </div>
      )}

      {/* Cost */}
      {effectiveCost != null && (
        <div style={{
          fontSize: '13px', color: 'var(--text-mid)',
          fontFamily: 'var(--font-sans)', marginBottom: '10px',
        }}>
          {nights} night{nights !== 1 ? 's' : ''}
          {acc.cost_per_night != null && (
            <> × {formatMoney(acc.cost_per_night)}</>
          )}
          {' = '}
          <strong style={{ color: 'var(--green-deep)' }}>{formatMoney(effectiveCost)}</strong>
          {acc.num_rooms != null && acc.num_rooms > 1 && (
            <span style={{ color: 'var(--text-light)', fontSize: '12px', marginLeft: '6px' }}>
              ({acc.num_rooms} rooms)
            </span>
          )}
        </div>
      )}

      {/* Website + Phone */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: acc.notes ? '10px' : 0 }}>
        {acc.website_url && (
          <a
            href={acc.website_url.startsWith('http') ? acc.website_url : `https://${acc.website_url}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '13px', color: 'var(--green-light)', textDecoration: 'none', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
          >
            View Hotel →
          </a>
        )}
        {acc.phone && (
          <a
            href={`tel:${acc.phone}`}
            style={{ fontSize: '13px', color: 'var(--text-mid)', textDecoration: 'none', fontFamily: 'var(--font-sans)' }}
          >
            📞 {acc.phone}
          </a>
        )}
      </div>

      {/* Notes */}
      {acc.notes && (
        <div style={{
          fontSize: '12px', color: 'var(--text-light)',
          fontStyle: 'italic', fontFamily: 'var(--font-sans)', lineHeight: 1.6,
          marginTop: '8px',
        }}>
          {acc.notes}
        </div>
      )}
    </div>
  )
}

// ─── Suggestions Panel ────────────────────────────────────────────────────────

function SuggestionsPanel({
  suggestions, onSelect, onClose,
}: {
  suggestions: LodgingSuggestion[]
  onSelect:    (s: LodgingSuggestion) => void
  onClose:     () => void
}) {
  const byCourse: Record<string, LodgingSuggestion[]> = {}
  for (const s of suggestions) {
    ;(byCourse[s.courseName] ??= []).push(s)
  }
  const courseNames = Object.keys(byCourse)

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 50 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '520px', maxWidth: 'calc(100vw - 48px)',
        maxHeight: '80vh',
        background: 'var(--white)', borderRadius: '16px',
        zIndex: 51, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        animation: 'acc-fadeIn 0.18s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 24px 16px', borderBottom: '1px solid var(--cream-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--green-deep)', fontWeight: 600 }}>
              ✦ Suggested Accommodations
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)', marginTop: '2px' }}>
              Lodging options from your trip&apos;s courses
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1, padding: '4px' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {courseNames.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              fontSize: '13px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)',
            }}>
              No lodging data found for this trip&apos;s courses yet.
              <br />
              <span style={{ fontStyle: 'italic', fontSize: '12px' }}>
                Courses need to be enriched first via the admin panel.
              </span>
            </div>
          ) : courseNames.map(cn => (
            <div key={cn} style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--green-light)',
                fontFamily: 'var(--font-sans)', marginBottom: '10px',
              }}>
                📍 {cn}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {byCourse[cn].map((s, i) => (
                  <div key={i} style={{
                    background: 'var(--cream)', borderRadius: 'var(--radius-md)',
                    padding: '12px 14px', display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green-deep)', fontFamily: 'var(--font-sans)' }}>
                          {s.name}
                        </span>
                        <span style={{
                          fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                          textTransform: 'uppercase', padding: '2px 6px',
                          borderRadius: '20px',
                          background: s.type === 'on_property' ? 'rgba(196,168,79,0.2)' : 'rgba(74,124,74,0.12)',
                          color: s.type === 'on_property' ? '#b59a3c' : 'var(--green-light)',
                          fontFamily: 'var(--font-sans)',
                        }}>
                          {s.type === 'on_property' ? 'On Property' : 'Nearby'}
                        </span>
                      </div>
                      {s.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                          {s.description.length > 100 ? s.description.slice(0, 100) + '…' : s.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { onSelect(s); onClose() }}
                      style={{
                        flexShrink: 0, padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--green-light)', background: 'transparent',
                        color: 'var(--green-light)', fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                      }}
                    >
                      Quick Add →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes acc-fadeIn { from { opacity:0; transform:translate(-50%,-48%) } to { opacity:1; transform:translate(-50%,-50%) } }`}</style>
    </>
  )
}

// ─── Add / Edit Drawer ────────────────────────────────────────────────────────

function AddEditDrawer({
  form, onFieldChange, onTotalCostChange, tripCourses,
  saving, onSave, onClose,
}: {
  form:              FormState
  onFieldChange:     (key: keyof FormState, value: string) => void
  onTotalCostChange: (value: string) => void
  tripCourses:       string[]
  saving:            boolean
  onSave:            () => void
  onClose:           () => void
}) {
  const isEdit  = Boolean(form.id)
  const nights  = form.check_in_date && form.check_out_date
    ? daysBetween(form.check_in_date, form.check_out_date)
    : 0
  const autoTotal = form.cost_per_night && nights > 0
    ? (parseFloat(form.cost_per_night) * nights).toFixed(2)
    : null
  const canSave = !saving && form.name.trim().length > 0 && form.check_in_date.length > 0 && form.check_out_date.length > 0

  function field(
    key: keyof FormState,
    label: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={labelSt}>{label}</span>
        <input
          {...extra}
          value={(form[key] as string) ?? ''}
          onChange={e => onFieldChange(key, e.target.value)}
          style={inputSt}
        />
      </label>
    )
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 50 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
        background: 'var(--white)', zIndex: 51,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
        animation: 'acc-slideIn 0.22s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 18px', borderBottom: '1px solid var(--cream-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--green-deep)', fontWeight: 600 }}>
            {isEdit ? 'Edit Accommodation' : 'Add Accommodation'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Property name */}
          {field('name', 'Property Name *', { placeholder: 'The Lodge at Pebble Beach' })}

          {/* Address */}
          {field('address', 'Address', { placeholder: '1700 17-Mile Dr, Pebble Beach, CA' })}

          {/* Check-in / Check-out dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {field('check_in_date',  'Check-in Date *',  { type: 'date' })}
            {field('check_out_date', 'Check-out Date *', { type: 'date' })}
          </div>

          {/* Check-in / Check-out times */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {field('check_in_time',  'Check-in Time',  { type: 'time' })}
            {field('check_out_time', 'Check-out Time', { type: 'time' })}
          </div>

          {/* Nights preview */}
          {nights > 0 && (
            <div style={{
              padding: '10px 14px', background: 'rgba(74,124,74,0.08)',
              borderRadius: 'var(--radius-md)', fontSize: '12px',
              color: 'var(--green-deep)', fontFamily: 'var(--font-sans)',
            }}>
              🌙 {nights} night{nights !== 1 ? 's' : ''}
            </div>
          )}

          {/* Confirmation # */}
          {field('confirmation_number', 'Confirmation Number', { placeholder: 'e.g. HT-38291' })}

          {/* Rooms */}
          {field('num_rooms', 'Number of Rooms', { type: 'number', min: '1', placeholder: '2' })}

          {/* Costs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {field('cost_per_night', 'Cost per Night ($)', { type: 'number', min: '0', step: '0.01', placeholder: '450' })}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={labelSt}>Total Cost ($)</span>
              <input
                type="number" min="0" step="0.01"
                placeholder={autoTotal ?? ''}
                value={form.total_cost}
                onChange={e => onTotalCostChange(e.target.value)}
                style={inputSt}
              />
            </label>
          </div>

          {/* Total cost preview */}
          {autoTotal && !form.total_cost && (
            <div style={{
              padding: '10px 14px', background: 'rgba(196,168,79,0.1)',
              borderRadius: 'var(--radius-md)', fontSize: '12px',
              color: 'var(--green-deep)', fontFamily: 'var(--font-sans)',
            }}>
              💰 Auto-total: <strong>{formatMoney(parseFloat(autoTotal))}</strong>
              <span style={{ color: 'var(--text-light)', marginLeft: '6px' }}>
                ({nights} nights × {formatMoney(parseFloat(form.cost_per_night))})
              </span>
            </div>
          )}

          {/* Website */}
          {field('website_url', 'Website URL', { type: 'url', placeholder: 'https://…' })}

          {/* Phone */}
          {field('phone', 'Phone', { type: 'tel', placeholder: '+1 (800) 000-0000' })}

          {/* Notes */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelSt}>Notes</span>
            <textarea
              value={form.notes}
              onChange={e => onFieldChange('notes', e.target.value)}
              placeholder="Adjacent to the 1st tee, request early check-in…"
              rows={3}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--cream-dark)', flexShrink: 0 }}>
          <button
            onClick={onSave}
            disabled={!canSave}
            style={{
              width: '100%', padding: '13px', borderRadius: 'var(--radius-md)', border: 'none',
              background: canSave ? 'var(--green-deep)' : 'var(--cream-dark)',
              color:      canSave ? 'var(--gold-light)' : 'var(--text-light)',
              fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em',
              cursor: canSave ? 'pointer' : 'default',
              fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Accommodation'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes acc-slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  isOrganizer, onAdd, onSuggest, hasSuggestions,
}: {
  isOrganizer:    boolean
  onAdd:          () => void
  onSuggest:      () => void
  hasSuggestions: boolean
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, padding: '80px 40px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '52px', marginBottom: '18px' }}>🏨</div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '24px',
        color: 'var(--green-deep)', marginBottom: '10px', fontWeight: 600,
      }}>
        No accommodations added yet
      </div>
      <p style={{
        fontSize: '14px', color: 'var(--text-light)', fontWeight: 300,
        fontFamily: 'var(--font-sans)', maxWidth: '380px',
        lineHeight: 1.75, margin: '0 0 32px',
      }}>
        Add your hotel, lodge, or rental so everyone has the details.
        Check-in times, confirmation numbers, and addresses — all in one place.
      </p>
      {isOrganizer && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={onAdd}
            style={{
              padding: '12px 28px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--green-deep)', color: 'var(--gold-light)',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
              boxShadow: '0 4px 16px rgba(26,46,26,0.2)',
            }}
          >
            + Add Accommodation
          </button>
          {hasSuggestions && (
            <button
              onClick={onSuggest}
              style={{
                padding: '12px 22px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--cream-dark)', background: 'var(--white)',
                color: 'var(--green-deep)', fontSize: '14px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              ✦ Suggest from Courses
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccommodationsPage() {
  const rawParams   = useParams()
  const id          = rawParams.id as string
  const { session } = useAuth()
  const router      = useRouter()

  const [trip,         setTrip]         = useState<Trip | null>(null)
  const [accs,         setAccs]         = useState<Accommodation[]>([])
  const [memberCount,  setMemberCount]  = useState(0)
  const [suggestions,  setSuggestions]  = useState<LodgingSuggestion[]>([])
  const [loading,      setLoading]      = useState(true)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [suggestOpen,  setSuggestOpen]  = useState(false)
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)

  // Track whether total_cost was manually overridden in this drawer session
  const manualTotalRef = useRef(false)

  const isOrganizer = trip?.created_by === session?.user.id

  // ─── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadAll() {
    setLoading(true)
    const [tripRes, accsRes, membersRes, tcRes] = await Promise.all([
      supabase
        .from('trips')
        .select('id,name,destination,start_date,end_date,created_by')
        .eq('id', id)
        .single(),
      supabase
        .from('accommodations')
        .select('*')
        .eq('trip_id', id)
        .order('check_in_date'),
      supabase
        .from('trip_members')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', id),
      supabase
        .from('trip_courses')
        .select('course_id, course_name')
        .eq('trip_id', id),
    ])

    if (tripRes.data) setTrip(tripRes.data)
    if (accsRes.data) setAccs(accsRes.data)
    setMemberCount(membersRes.count ?? 0)

    // Fetch lodging suggestions from trip's courses
    const courseIds = (tcRes.data ?? []).map(tc => tc.course_id).filter(Boolean) as string[]
    if (courseIds.length > 0) {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('name, lodging_on_property, lodging_description, nearby_lodging')
        .in('id', courseIds)

      const allSuggestions: LodgingSuggestion[] = []
      for (const c of (coursesData ?? [])) {
        if (c.lodging_on_property) {
          allSuggestions.push({
            courseName:  c.name,
            type:        'on_property',
            name:        c.lodging_on_property,
            description: c.lodging_description ?? null,
          })
        }
        // Parse nearby_lodging JSONB array
        const nearby = Array.isArray(c.nearby_lodging) ? c.nearby_lodging : []
        for (const item of nearby) {
          if (typeof item === 'object' && item !== null) {
            const name = String(
              (item as Record<string, unknown>).name ??
              (item as Record<string, unknown>).hotel_name ??
              (item as Record<string, unknown>).property_name ?? ''
            ).trim()
            if (!name) continue
            const desc = (item as Record<string, unknown>).description
              ?? (item as Record<string, unknown>).details
              ?? null
            allSuggestions.push({
              courseName:  c.name,
              type:        'nearby',
              name,
              description: desc ? String(desc) : null,
            })
          }
        }
      }
      setSuggestions(allSuggestions)
    }

    setLoading(false)
  }

  // ─── Nav ────────────────────────────────────────────────────────────────────

  function handleNav(navId: string) {
    if (navId === 'hotels')   return
    if (navId === 'games')    { router.push(`/trip/${id}/games`);          return }
    if (navId === 'report')   { router.push(`/trip/${id}/report`);         return }
    if (navId === 'teetimes') { router.push(`/trip/${id}/tee-times`);      return }
    if (navId === 'budget')   { router.push(`/trip/${id}/budget`);         return }
    if (navId === 'itinerary' || navId === 'group' || navId === 'concierge') {
      router.push(`/trip/${id}?tab=${navId}`)
      return
    }
    router.push(`/trip/${id}`)
  }

  // ─── Form field change (with auto-calc) ─────────────────────────────────────

  function handleFieldChange(key: keyof FormState, value: string) {
    setForm(prev => {
      const next = { ...prev, [key]: value }

      // Auto-calculate total_cost when cost/dates change (unless user manually set it)
      if (['cost_per_night', 'check_in_date', 'check_out_date'].includes(key) && !manualTotalRef.current) {
        const ci = key === 'check_in_date'  ? value : prev.check_in_date
        const co = key === 'check_out_date' ? value : prev.check_out_date
        const cn = key === 'cost_per_night' ? value : prev.cost_per_night
        if (cn && ci && co) {
          const nights = daysBetween(ci, co)
          if (nights > 0) {
            next.total_cost = (parseFloat(cn) * nights).toFixed(2)
          }
        }
      }
      return next
    })
  }

  function handleTotalCostChange(value: string) {
    manualTotalRef.current = true
    setForm(prev => ({ ...prev, total_cost: value }))
  }

  // ─── Drawer helpers ─────────────────────────────────────────────────────────

  function openAdd(defaults: Partial<FormState> = {}) {
    manualTotalRef.current = false
    setForm({
      ...EMPTY_FORM,
      check_in_date:  trip?.start_date ?? '',
      check_out_date: trip?.end_date   ?? '',
      ...defaults,
    })
    setDrawerOpen(true)
  }

  function openEdit(acc: Accommodation) {
    manualTotalRef.current = true // editing: don't auto-overwrite existing total
    setForm({
      id:                  acc.id,
      name:                acc.name,
      address:             acc.address             ?? '',
      phone:               acc.phone               ?? '',
      website_url:         acc.website_url         ?? '',
      check_in_date:       acc.check_in_date,
      check_out_date:      acc.check_out_date,
      check_in_time:       acc.check_in_time.substring(0, 5),
      check_out_time:      acc.check_out_time.substring(0, 5),
      confirmation_number: acc.confirmation_number ?? '',
      num_rooms:           acc.num_rooms           != null ? String(acc.num_rooms)      : '',
      cost_per_night:      acc.cost_per_night      != null ? String(acc.cost_per_night) : '',
      total_cost:          acc.total_cost          != null ? String(acc.total_cost)     : '',
      notes:               acc.notes               ?? '',
    })
    setDrawerOpen(true)
  }

  function applysuggestion(s: LodgingSuggestion) {
    openAdd({
      name:  s.name,
      notes: s.description ?? '',
    })
  }

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim() || !form.check_in_date || !form.check_out_date) return
    setSaving(true)

    const nights = daysBetween(form.check_in_date, form.check_out_date)
    const computedTotal = form.total_cost
      ? parseFloat(form.total_cost)
      : (form.cost_per_night && nights > 0 ? parseFloat(form.cost_per_night) * nights : null)

    const payload = {
      trip_id:              id,
      name:                 form.name.trim(),
      address:              form.address.trim()             || null,
      phone:                form.phone.trim()               || null,
      website_url:          form.website_url.trim()         || null,
      check_in_date:        form.check_in_date,
      check_out_date:       form.check_out_date,
      check_in_time:        form.check_in_time              || '15:00',
      check_out_time:       form.check_out_time             || '11:00',
      confirmation_number:  form.confirmation_number.trim() || null,
      num_rooms:            form.num_rooms                  ? Number(form.num_rooms)      : null,
      cost_per_night:       form.cost_per_night             ? Number(form.cost_per_night) : null,
      total_cost:           computedTotal,
      notes:                form.notes.trim()               || null,
      added_by:             session?.user.id                ?? null,
    }

    let saved: Accommodation | null = null

    if (form.id) {
      const { data } = await supabase
        .from('accommodations').update(payload).eq('id', form.id).select().single()
      if (data) {
        saved = data
        setAccs(prev => prev.map(a => a.id === data.id ? data : a))
      }
    } else {
      const { data } = await supabase
        .from('accommodations').insert(payload).select().single()
      if (data) {
        saved = data
        setAccs(prev => [...prev, data].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date)))
      }
    }

    // Budget integration — upsert lodging line item
    if (saved && computedTotal != null) {
      try {
        await supabase.from('budget_items').upsert(
          {
            trip_id:     id,
            category:    'lodging',
            label:       `Lodging — ${saved.name}`,
            amount:      computedTotal,
            source_type: 'accommodation',
            source_id:   saved.id,
            added_by:    session?.user.id ?? null,
          },
          { onConflict: 'source_type,source_id' }
        )
      } catch { /* budget_items table may not exist yet */ }
    } else if (saved) {
      // Cost removed on edit — delete budget item
      try {
        await supabase.from('budget_items')
          .delete().eq('source_type', 'accommodation').eq('source_id', saved.id)
      } catch { /* ignore */ }
    }

    // Itinerary sync — insert check-in/check-out items
    if (saved && trip?.start_date) {
      try {
        await syncAccommodationToItinerary(supabase, saved, trip.start_date, session?.user.id ?? null)
      } catch { /* itinerary sync is best-effort */ }
    }

    setSaving(false)
    setDrawerOpen(false)
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(acc: Accommodation) {
    await supabase.from('accommodations').delete().eq('id', acc.id)
    setAccs(prev => prev.filter(a => a.id !== acc.id))
    try {
      await supabase.from('budget_items')
        .delete().eq('source_type', 'accommodation').eq('source_id', acc.id)
    } catch { /* ignore */ }
    // Remove check-in/check-out itinerary items
    if (trip?.start_date) {
      try {
        await removeAccommodationFromItinerary(supabase, acc, trip.start_date)
      } catch { /* best-effort */ }
    }
  }

  // ─── Scroll to card ──────────────────────────────────────────────────────────

  function scrollToCard(accId: string) {
    document.getElementById(`acc-${accId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ─── Computed ────────────────────────────────────────────────────────────────

  const hasAccs       = accs.length > 0
  const hasSuggestions = suggestions.length > 0
  const tripStart     = trip?.start_date ?? null
  const tripEnd       = trip?.end_date   ?? null

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <div style={{
        display: 'flex', height: '100vh', overflow: 'hidden',
        fontFamily: 'var(--font-sans)', background: 'var(--cream)',
      }}>

        {/* Sidebar */}
        {trip && (
          <Sidebar
            navItems={buildNavItems(memberCount)}
            activeId="hotels"
            onItemClick={handleNav}
            tripName={trip.name}
            tripMeta={buildTripMeta(tripStart, tripEnd, memberCount)}
            groupName="The Crew"
          />
        )}

        {/* Main column */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {loading && (
            <div style={{ padding: '80px', textAlign: 'center', fontSize: '13px', color: 'var(--text-light)' }}>
              Loading…
            </div>
          )}

          {trip && !loading && (
            <>
              {/* Page header */}
              <div style={{
                padding: '24px 48px 18px', borderBottom: '1px solid var(--cream-dark)',
                background: 'var(--white)', position: 'sticky', top: 0, zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div>
                  <div style={{
                    fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
                    color: 'var(--green-light)', fontWeight: 600, marginBottom: '3px',
                  }}>
                    Accommodations
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-serif)', fontSize: '22px',
                    color: 'var(--green-deep)', fontWeight: 600,
                  }}>
                    {trip.name}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isOrganizer && hasSuggestions && (
                    <button
                      onClick={() => setSuggestOpen(true)}
                      style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--cream-dark)', background: 'var(--white)',
                        color: 'var(--green-deep)', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      ✦ Suggest
                    </button>
                  )}
                  {isOrganizer && hasAccs && (
                    <button
                      onClick={() => openAdd()}
                      style={{
                        padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none',
                        background: 'var(--green-deep)', color: 'var(--gold-light)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      + Add
                    </button>
                  )}
                  <Link href={`/trip/${id}`} style={{ fontSize: '12px', color: 'var(--text-light)', textDecoration: 'none' }}>
                    ← Trip
                  </Link>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '36px 48px', flex: 1, display: 'flex', flexDirection: 'column' }}>

                {!hasAccs ? (
                  <EmptyState
                    isOrganizer={isOrganizer}
                    onAdd={() => openAdd()}
                    onSuggest={() => setSuggestOpen(true)}
                    hasSuggestions={hasSuggestions}
                  />
                ) : (
                  <>
                    <SummaryBar accs={accs} />

                    {/* Timeline — only when trip has date range */}
                    {tripStart && tripEnd && tripStart !== tripEnd && (
                      <StayTimeline
                        accs={accs}
                        tripStart={tripStart}
                        tripEnd={tripEnd}
                        onAccClick={scrollToCard}
                      />
                    )}

                    {/* Accommodation cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {accs.map(acc => (
                        <AccommodationCard
                          key={acc.id}
                          acc={acc}
                          isOrganizer={isOrganizer}
                          onEdit={openEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Add / Edit Drawer */}
        {drawerOpen && (
          <AddEditDrawer
            form={form}
            onFieldChange={handleFieldChange}
            onTotalCostChange={handleTotalCostChange}
            tripCourses={[]}
            saving={saving}
            onSave={handleSave}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        {/* Suggestions Panel */}
        {suggestOpen && (
          <SuggestionsPanel
            suggestions={suggestions}
            onSelect={applysuggestion}
            onClose={() => setSuggestOpen(false)}
          />
        )}

      </div>
    </ProtectedRoute>
  )
}
