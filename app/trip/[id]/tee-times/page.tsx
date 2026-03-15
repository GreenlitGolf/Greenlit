'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/ui/Sidebar'
import type { NavItem } from '@/components/ui/Sidebar'
import { syncTeeTimeToItinerary, removeTeeTimeFromItinerary } from '@/lib/syncItinerary'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id:          string
  name:        string
  destination: string | null
  start_date:  string | null
  end_date:    string | null
  created_by:  string
  share_token: string | null
}

type TeeTime = {
  id:                   string
  trip_id:              string
  course_id:            string | null
  course_name:          string
  tee_date:             string   // YYYY-MM-DD
  tee_time:             string   // HH:MM:SS or HH:MM
  num_players:          number | null
  confirmation_number:  string | null
  booking_url:          string | null
  green_fee_per_player: number | null
  cart_fee_per_player:  number | null
  notes:                string | null
  added_by:             string | null
  created_at:           string
}

type TripCourseOption = {
  course_id:   string | null
  course_name: string | null
}

type CourseResult = {
  id:       string
  name:     string
  location: string
}

type FormState = {
  id?:                  string
  course_id:            string
  course_name:          string
  tee_date:             string
  tee_time:             string
  num_players:          string
  confirmation_number:  string
  booking_url:          string
  green_fee_per_player: string
  cart_fee_per_player:  string
  notes:                string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  course_id: '', course_name: '', tee_date: '', tee_time: '',
  num_players: '', confirmation_number: '', booking_url: '',
  green_fee_per_player: '', cart_fee_per_player: '', notes: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime12(s: string): string {
  const [hStr, mStr] = s.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${mStr} ${period}`
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function getTripDays(start: string | null, end: string | null): string[] {
  if (!start) return []
  const s = new Date(start + 'T12:00:00')
  const e = end ? new Date(end + 'T12:00:00') : s
  const days: string[] = []
  const cur = new Date(s)
  while (cur <= e) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function formatDayHeader(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function buildTripMeta(start: string | null, end: string | null, count: number): string {
  const parts: string[] = []
  if (start) {
    const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = end ? new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
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

function getCountdown(teeDate: string, teeTimeStr: string): string | null {
  const now = new Date()
  const dt  = new Date(`${teeDate}T${teeTimeStr}`)
  const diffMs = dt.getTime() - now.getTime()
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

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function SummaryBar({ teeTimes }: { teeTimes: TeeTime[] }) {
  const totalGreenFees = teeTimes.reduce((sum, tt) => {
    if (!tt.green_fee_per_player || !tt.num_players) return sum
    return sum + tt.green_fee_per_player * tt.num_players
  }, 0)

  const now      = new Date()
  const upcoming = [...teeTimes]
    .filter(tt => new Date(`${tt.tee_date}T${tt.tee_time}`) > now)
    .sort((a, b) =>
      new Date(`${a.tee_date}T${a.tee_time}`).getTime() -
      new Date(`${b.tee_date}T${b.tee_time}`).getTime()
    )
  const next = upcoming[0] ?? null

  const stats = [
    {
      label: 'Total Rounds',
      value: String(teeTimes.length),
      sub:   `round${teeTimes.length !== 1 ? 's' : ''} booked`,
    },
    {
      label: 'Total Green Fees',
      value: totalGreenFees > 0 ? formatMoney(totalGreenFees) : '—',
      sub:   totalGreenFees > 0 ? 'across all rounds' : 'no fees logged yet',
    },
    {
      label: 'Next Tee Time',
      value: next ? formatTime12(next.tee_time) : '—',
      sub:   next
        ? (getCountdown(next.tee_date, next.tee_time) ?? formatDayHeader(next.tee_date))
        : 'no upcoming tee times',
    },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1px', background: 'var(--cream-dark)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      border: '1px solid var(--cream-dark)', marginBottom: '32px',
    }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: 'var(--white)', padding: '20px 24px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text-light)',
            fontFamily: 'var(--font-sans)', marginBottom: '6px',
          }}>
            {s.label}
          </div>
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

// ─── Tee Time Card ────────────────────────────────────────────────────────────

function TeeTimeCard({
  tt, isOrganizer, onEdit, onDelete,
}: {
  tt:          TeeTime
  isOrganizer: boolean
  onEdit:      (tt: TeeTime) => void
  onDelete:    (tt: TeeTime) => void
}) {
  const [copied,     setCopied]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const greenTotal = tt.green_fee_per_player != null && tt.num_players != null
    ? tt.green_fee_per_player * tt.num_players
    : null

  function copyConf() {
    if (!tt.confirmation_number) return
    navigator.clipboard.writeText(tt.confirmation_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: 'var(--white)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--cream-dark)', padding: '20px 24px',
      display: 'flex', gap: '20px', alignItems: 'flex-start',
    }}>
      {/* Time column */}
      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '90px' }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '30px',
          color: 'var(--gold)', fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.01em',
        }}>
          {formatTime12(tt.tee_time)}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', background: 'var(--cream-dark)', alignSelf: 'stretch', flexShrink: 0 }} />

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Course + players */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '17px',
            color: 'var(--green-deep)', fontWeight: 600, marginBottom: '3px',
          }}>
            {tt.course_name}
          </div>
          {tt.num_players != null && (
            <div style={{ fontSize: '12px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>
              {tt.num_players} player{tt.num_players !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Confirmation # */}
        {tt.confirmation_number && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: 'var(--text-light)',
              textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-sans)',
            }}>
              Conf #
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-dark)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
              {tt.confirmation_number}
            </span>
            <button
              onClick={copyConf}
              title="Copy confirmation number"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 5px', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', lineHeight: 1,
                color: copied ? 'var(--green-light)' : 'var(--text-light)',
                transition: 'color 0.15s',
              }}
            >
              {copied ? '✓' : '⧉'}
            </button>
          </div>
        )}

        {/* Green fee breakdown */}
        {greenTotal != null && (
          <div style={{
            fontSize: '13px', color: 'var(--text-mid)',
            fontFamily: 'var(--font-sans)', marginBottom: '8px',
          }}>
            {tt.num_players} × {formatMoney(tt.green_fee_per_player!)}
            {' = '}
            <strong style={{ color: 'var(--green-deep)' }}>{formatMoney(greenTotal)}</strong>
            {tt.cart_fee_per_player != null && (
              <span style={{ color: 'var(--text-light)', marginLeft: '8px', fontSize: '12px' }}>
                + {formatMoney(tt.cart_fee_per_player)}/cart
              </span>
            )}
          </div>
        )}

        {/* Booking URL */}
        {tt.booking_url && (
          <div style={{ marginBottom: '8px' }}>
            <a
              href={tt.booking_url.startsWith('http') ? tt.booking_url : `https://${tt.booking_url}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px', color: 'var(--green-light)',
                textDecoration: 'none', fontFamily: 'var(--font-sans)',
                fontWeight: 500,
              }}
            >
              View Booking →
            </a>
          </div>
        )}

        {/* Notes */}
        {tt.notes && (
          <div style={{
            fontSize: '12px', color: 'var(--text-light)',
            fontStyle: 'italic', fontFamily: 'var(--font-sans)', lineHeight: 1.6,
          }}>
            {tt.notes}
          </div>
        )}
      </div>

      {/* Organizer actions */}
      {isOrganizer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          {!confirmDel ? (
            <>
              <button
                onClick={() => onEdit(tt)}
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
                onClick={() => onDelete(tt)}
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
  )
}

// ─── Course Combobox ──────────────────────────────────────────────────────────

function CourseCombobox({
  value, courseId, tripCourses, onChange,
}: {
  value:       string
  courseId:    string
  tripCourses: TripCourseOption[]
  onChange:    (name: string, id: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [text,    setText]    = useState(value)
  const [results, setResults] = useState<CourseResult[]>([])
  const [busy,    setBusy]    = useState(false)

  useEffect(() => { setText(value) }, [value])

  useEffect(() => {
    if (text.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setBusy(true)
      const { data } = await supabase
        .from('courses')
        .select('id, name, location')
        .ilike('name', `%${text}%`)
        .limit(8)
      setResults(data ?? [])
      setBusy(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [text])

  const filteredTrip = tripCourses.filter(
    tc => tc.course_name && (!text || tc.course_name.toLowerCase().includes(text.toLowerCase()))
  )
  const filteredAll = results.filter(r => !tripCourses.some(tc => tc.course_id === r.id))
  const showDrop    = open && (filteredTrip.length > 0 || filteredAll.length > 0 || busy)

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={text}
        placeholder="Type a course name to search…"
        onChange={(e) => { setText(e.target.value); onChange(e.target.value, ''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        style={inputSt}
      />

      {showDrop && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid var(--cream-dark)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          maxHeight: '260px', overflowY: 'auto',
        }}>
          {/* Trip's courses */}
          {filteredTrip.length > 0 && (
            <>
              <div style={{
                padding: '8px 12px 4px', fontSize: '10px', color: 'var(--text-light)',
                textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
                fontFamily: 'var(--font-sans)',
              }}>
                This Trip
              </div>
              {filteredTrip.map((tc) => (
                <button
                  key={tc.course_id ?? tc.course_name}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(tc.course_name ?? '', tc.course_id ?? '')
                    setText(tc.course_name ?? '')
                    setOpen(false)
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: '13px', color: 'var(--green-deep)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  ⛳ {tc.course_name}
                </button>
              ))}
            </>
          )}

          {/* All courses search */}
          {filteredAll.length > 0 && (
            <>
              <div style={{
                padding: '8px 12px 4px', fontSize: '10px', color: 'var(--text-light)',
                textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
                borderTop: filteredTrip.length > 0 ? '1px solid var(--cream-dark)' : 'none',
                fontFamily: 'var(--font-sans)',
              }}>
                All Courses
              </div>
              {filteredAll.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(c.name, c.id)
                    setText(c.name)
                    setOpen(false)
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: '13px', color: 'var(--text-dark)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {c.name}
                  <span style={{ fontSize: '11px', color: 'var(--text-light)', marginLeft: '8px' }}>
                    {c.location}
                  </span>
                </button>
              ))}
            </>
          )}

          {busy && (
            <div style={{
              padding: '12px', textAlign: 'center',
              fontSize: '12px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)',
            }}>
              Searching…
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit Drawer ────────────────────────────────────────────────────────

function AddEditDrawer({
  form, setForm, tripCourses, saving, onSave, onClose,
}: {
  form:        FormState
  setForm:     React.Dispatch<React.SetStateAction<FormState>>
  tripCourses: TripCourseOption[]
  saving:      boolean
  onSave:      () => void
  onClose:     () => void
}) {
  const isEdit  = Boolean(form.id)
  const canSave = !saving && form.course_name.trim().length > 0 && form.tee_date.length > 0 && form.tee_time.length > 0

  const feePreview = form.green_fee_per_player && form.num_players
    ? Number(form.green_fee_per_player) * Number(form.num_players)
    : null

  function textField(
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
          onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={inputSt}
        />
      </label>
    )
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 50 }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
        background: 'var(--white)', zIndex: 51,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
        animation: 'tt-slideIn 0.22s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 18px', borderBottom: '1px solid var(--cream-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--green-deep)', fontWeight: 600 }}>
            {isEdit ? 'Edit Tee Time' : 'Add Tee Time'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          {/* Course */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelSt}>Course *</span>
            <CourseCombobox
              value={form.course_name}
              courseId={form.course_id}
              tripCourses={tripCourses}
              onChange={(name, id) => setForm(f => ({ ...f, course_name: name, course_id: id }))}
            />
          </label>

          {/* Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {textField('tee_date', 'Date *', { type: 'date' })}
            {textField('tee_time', 'Time *', { type: 'time' })}
          </div>

          {/* Players */}
          {textField('num_players', 'Number of Players', {
            type: 'number', min: '1', max: '24', placeholder: '4',
          })}

          {/* Confirmation # */}
          {textField('confirmation_number', 'Confirmation Number', {
            placeholder: 'e.g. GF-20948',
          })}

          {/* Booking URL */}
          {textField('booking_url', 'Booking URL', {
            type: 'url', placeholder: 'https://…',
          })}

          {/* Fees */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {textField('green_fee_per_player', 'Green Fee / Player', {
              type: 'number', min: '0', step: '0.01', placeholder: '185',
            })}
            {textField('cart_fee_per_player', 'Cart Fee / Player', {
              type: 'number', min: '0', step: '0.01', placeholder: '25',
            })}
          </div>

          {/* Green fee preview */}
          {feePreview != null && (
            <div style={{
              padding: '11px 14px', background: 'rgba(196,168,79,0.12)',
              borderRadius: 'var(--radius-md)', fontSize: '13px',
              color: 'var(--green-deep)', fontFamily: 'var(--font-sans)',
            }}>
              💰 Total green fees: <strong>{formatMoney(feePreview)}</strong>
              <span style={{ color: 'var(--text-light)', marginLeft: '6px', fontSize: '12px' }}>
                ({form.num_players} players × {formatMoney(Number(form.green_fee_per_player))})
              </span>
            </div>
          )}

          {/* Notes */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelSt}>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Walking only, soft spikes required, caddies available…"
              rows={3}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </label>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px', borderTop: '1px solid var(--cream-dark)', flexShrink: 0,
        }}>
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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Tee Time'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes tt-slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ isOrganizer, onAdd }: { isOrganizer: boolean; onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, padding: '80px 40px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '52px', marginBottom: '18px' }}>⛳</div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '24px',
        color: 'var(--green-deep)', marginBottom: '10px', fontWeight: 600,
      }}>
        No tee times booked yet
      </div>
      <p style={{
        fontSize: '14px', color: 'var(--text-light)', fontWeight: 300,
        fontFamily: 'var(--font-sans)', maxWidth: '380px',
        lineHeight: 1.75, margin: '0 0 32px',
      }}>
        Add your confirmed tee times to keep the crew organized. Confirmation numbers,
        green fees, and booking links — all in one place.
      </p>
      {isOrganizer ? (
        <button
          onClick={onAdd}
          style={{
            padding: '13px 32px', borderRadius: 'var(--radius-md)', border: 'none',
            background: 'var(--green-deep)', color: 'var(--gold-light)',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
            boxShadow: '0 4px 16px rgba(26,46,26,0.2)',
          }}
        >
          + Add Tee Time
        </button>
      ) : (
        <div style={{
          fontSize: '13px', color: 'var(--text-light)',
          fontFamily: 'var(--font-sans)', fontStyle: 'italic',
        }}>
          The organizer hasn't added any tee times yet.
        </div>
      )}
    </div>
  )
}

// ─── Day Section ─────────────────────────────────────────────────────────────

function DaySection({
  dateStr, teeTimes, isOrganizer, onAdd, onEdit, onDelete,
}: {
  dateStr:     string
  teeTimes:    TeeTime[]
  isOrganizer: boolean
  onAdd:       () => void
  onEdit:      (tt: TeeTime) => void
  onDelete:    (tt: TeeTime) => void
}) {
  return (
    <div style={{ marginBottom: '36px' }}>
      {/* Day header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h3 style={{
            fontFamily: 'var(--font-serif)', fontSize: '17px',
            color: 'var(--green-deep)', fontWeight: 600, margin: 0,
          }}>
            {formatDayHeader(dateStr)}
          </h3>
          {teeTimes.length > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>
              {teeTimes.length} tee time{teeTimes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isOrganizer && (
          <button
            onClick={onAdd}
            style={{
              fontSize: '12px', color: 'var(--green-light)', background: 'none',
              border: '1px solid rgba(74,124,74,0.35)', borderRadius: 'var(--radius-sm)',
              padding: '6px 13px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              fontWeight: 500, transition: 'all 0.15s',
            }}
          >
            + Add Tee Time
          </button>
        )}
      </div>

      {/* Cards */}
      {teeTimes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {teeTimes.map(tt => (
            <TeeTimeCard
              key={tt.id}
              tt={tt}
              isOrganizer={isOrganizer}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div style={{
          border: '1px dashed var(--cream-dark)', borderRadius: 'var(--radius-lg)',
          padding: '22px', textAlign: 'center',
          fontSize: '13px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)',
        }}>
          No tee times booked for this day
          {isOrganizer && (
            <span style={{ marginLeft: '6px' }}>
              — <button
                onClick={onAdd}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-light)', fontSize: '13px', fontFamily: 'var(--font-sans)', padding: 0 }}
              >
                add one
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeeTimesPage() {
  const rawParams    = useParams()
  const id           = rawParams.id as string
  const { session }  = useAuth()
  const router       = useRouter()

  const [trip,        setTrip]        = useState<Trip | null>(null)
  const [teeTimes,    setTeeTimes]    = useState<TeeTime[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [tripCourses, setTripCourses] = useState<TripCourseOption[]>([])
  const [loading,     setLoading]     = useState(true)
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)

  const isOrganizer = trip?.created_by === session?.user.id

  // ─── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadAll() {
    setLoading(true)
    const [tripRes, ttRes, membersRes, tcRes] = await Promise.all([
      supabase
        .from('trips')
        .select('id,name,destination,start_date,end_date,created_by,share_token')
        .eq('id', id)
        .single(),
      supabase
        .from('tee_times')
        .select('*')
        .eq('trip_id', id)
        .order('tee_date')
        .order('tee_time'),
      supabase
        .from('trip_members')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', id),
      supabase
        .from('trip_courses')
        .select('course_id, course_name')
        .eq('trip_id', id),
    ])

    if (tripRes.data)  setTrip(tripRes.data)
    if (ttRes.data)    setTeeTimes(ttRes.data)
    setMemberCount(membersRes.count ?? 0)
    setTripCourses((tcRes.data ?? []).filter(tc => tc.course_name))
    setLoading(false)
  }

  // ─── Nav ────────────────────────────────────────────────────────────────────

  function handleNav(navId: string) {
    if (navId === 'teetimes') return
    if (navId === 'games')    { router.push(`/trip/${id}/games`);          return }
    if (navId === 'report')   { router.push(`/trip/${id}/report`);         return }
    if (navId === 'budget')   { router.push(`/trip/${id}/budget`);         return }
    if (navId === 'hotels')   { router.push(`/trip/${id}/accommodations`); return }
    if (navId === 'itinerary' || navId === 'group' || navId === 'concierge') {
      router.push(`/trip/${id}?tab=${navId}`)
      return
    }
    router.push(`/trip/${id}`)
  }

  // ─── Drawer helpers ─────────────────────────────────────────────────────────

  function openAdd(defaultDate?: string) {
    setForm({
      ...EMPTY_FORM,
      tee_date:    defaultDate ?? (trip?.start_date ?? ''),
      num_players: memberCount > 0 ? String(memberCount) : '',
    })
    setDrawerOpen(true)
  }

  function openEdit(tt: TeeTime) {
    setForm({
      id:                   tt.id,
      course_id:            tt.course_id ?? '',
      course_name:          tt.course_name,
      tee_date:             tt.tee_date,
      tee_time:             tt.tee_time.substring(0, 5), // HH:MM
      num_players:          tt.num_players != null ? String(tt.num_players) : '',
      confirmation_number:  tt.confirmation_number ?? '',
      booking_url:          tt.booking_url ?? '',
      green_fee_per_player: tt.green_fee_per_player != null ? String(tt.green_fee_per_player) : '',
      cart_fee_per_player:  tt.cart_fee_per_player  != null ? String(tt.cart_fee_per_player)  : '',
      notes:                tt.notes ?? '',
    })
    setDrawerOpen(true)
  }

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.course_name.trim() || !form.tee_date || !form.tee_time) return
    setSaving(true)

    const payload = {
      trip_id:              id,
      course_id:            form.course_id || null,
      course_name:          form.course_name.trim(),
      tee_date:             form.tee_date,
      tee_time:             form.tee_time,
      num_players:          form.num_players          ? Number(form.num_players)          : null,
      confirmation_number:  form.confirmation_number.trim()  || null,
      booking_url:          form.booking_url.trim()          || null,
      green_fee_per_player: form.green_fee_per_player ? Number(form.green_fee_per_player) : null,
      cart_fee_per_player:  form.cart_fee_per_player  ? Number(form.cart_fee_per_player)  : null,
      notes:                form.notes.trim()                || null,
      added_by:             session?.user.id ?? null,
    }

    let saved: TeeTime | null = null

    if (form.id) {
      const { data } = await supabase
        .from('tee_times').update(payload).eq('id', form.id).select().single()
      if (data) {
        saved = data
        setTeeTimes(prev => prev.map(t => t.id === data.id ? data : t))
      }
    } else {
      const { data } = await supabase
        .from('tee_times').insert(payload).select().single()
      if (data) {
        saved = data
        setTeeTimes(prev =>
          [...prev, data].sort((a, b) =>
            a.tee_date.localeCompare(b.tee_date) || a.tee_time.localeCompare(b.tee_time)
          )
        )
      }
    }

    // Budget integration — group green fee items by course+date
    if (saved) {
      try {
        // Find all tee times for this trip with same course name + date
        const { data: siblings } = await supabase
          .from('tee_times')
          .select('id, green_fee_per_player, num_players, tee_time')
          .eq('trip_id', id)
          .eq('course_name', saved.course_name)
          .eq('tee_date', saved.tee_date)

        const allSiblings = siblings || []
        const siblingIds = allSiblings.map(s => s.id)

        // Delete ALL budget items linked to any of these sibling tee times
        if (siblingIds.length > 0) {
          await supabase.from('budget_items')
            .delete()
            .eq('source_type', 'tee_time')
            .in('source_id', siblingIds)
        }

        // Recalculate: sum fees across all siblings with valid data
        const withFees = allSiblings.filter(
          s => s.green_fee_per_player != null && s.num_players != null
        )
        if (withFees.length > 0) {
          const totalAmount = withFees.reduce(
            (sum, s) => sum + (s.green_fee_per_player! * s.num_players!), 0
          )
          const totalPlayers = withFees.reduce(
            (sum, s) => sum + (s.num_players ?? 0), 0
          )
          const dateLabel = new Date(saved.tee_date + 'T12:00:00')
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const groupLabel = withFees.length === 1
            ? `Green Fees — ${saved.course_name}`
            : `Green Fees — ${saved.course_name} (${dateLabel} · ${withFees.length} groups · ${totalPlayers} players)`

          await supabase.from('budget_items').insert({
            trip_id:     id,
            category:    'green_fees',
            label:       groupLabel,
            amount:      totalAmount,
            source_type: 'tee_time',
            source_id:   withFees[0].id, // link to first tee time in group
            added_by:    session?.user.id ?? null,
          })
        }
      } catch {
        // Budget table may not exist yet; ignore silently
      }

      // Itinerary sync — upsert matching itinerary item
      if (trip?.start_date) {
        try {
          await syncTeeTimeToItinerary(supabase, saved, trip.start_date, session?.user.id ?? null)
        } catch { /* itinerary sync is best-effort */ }
      }
    }

    setSaving(false)
    setDrawerOpen(false)
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(tt: TeeTime) {
    await supabase.from('tee_times').delete().eq('id', tt.id)
    setTeeTimes(prev => prev.filter(t => t.id !== tt.id))

    // Re-group budget items for remaining siblings with same course+date
    try {
      const { data: siblings } = await supabase
        .from('tee_times')
        .select('id, green_fee_per_player, num_players, tee_time')
        .eq('trip_id', id)
        .eq('course_name', tt.course_name)
        .eq('tee_date', tt.tee_date)

      const allSiblings = siblings || []
      const allIds = [...allSiblings.map(s => s.id), tt.id]

      // Delete all budget items for this course+date group (including the deleted tee time)
      await supabase.from('budget_items')
        .delete()
        .eq('source_type', 'tee_time')
        .in('source_id', allIds)

      // Re-create grouped item if any siblings remain with fees
      const withFees = allSiblings.filter(
        s => s.green_fee_per_player != null && s.num_players != null
      )
      if (withFees.length > 0) {
        const totalAmount = withFees.reduce(
          (sum, s) => sum + (s.green_fee_per_player! * s.num_players!), 0
        )
        const totalPlayers = withFees.reduce(
          (sum, s) => sum + (s.num_players ?? 0), 0
        )
        const dateLabel = new Date(tt.tee_date + 'T12:00:00')
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const groupLabel = withFees.length === 1
          ? `Green Fees — ${tt.course_name}`
          : `Green Fees — ${tt.course_name} (${dateLabel} · ${withFees.length} groups · ${totalPlayers} players)`

        await supabase.from('budget_items').insert({
          trip_id:     id,
          category:    'green_fees',
          label:       groupLabel,
          amount:      totalAmount,
          source_type: 'tee_time',
          source_id:   withFees[0].id,
          added_by:    session?.user.id ?? null,
        })
      }
    } catch { /* ignore */ }

    // Remove matching itinerary item
    if (trip?.start_date) {
      try {
        await removeTeeTimeFromItinerary(supabase, tt, trip.start_date)
      } catch { /* best-effort */ }
    }
  }

  // ─── Computed values ────────────────────────────────────────────────────────

  const tripDays    = getTripDays(trip?.start_date ?? null, trip?.end_date ?? null)
  const hasTeeTimes = teeTimes.length > 0

  // Group by date
  const byDate: Record<string, TeeTime[]> = {}
  for (const tt of teeTimes) {
    (byDate[tt.tee_date] ??= []).push(tt)
  }

  // Tee times outside the trip date range
  const extraDates = Object.keys(byDate)
    .filter(d => !tripDays.includes(d))
    .sort()

  // ─── Render ─────────────────────────────────────────────────────────────────

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
            activeId="teetimes"
            onItemClick={handleNav}
            tripName={trip.name}
            tripMeta={buildTripMeta(trip.start_date, trip.end_date, memberCount)}
            groupName="The Crew"
          />
        )}

        {/* Main column */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Loading */}
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
                    Tee Times
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-serif)', fontSize: '22px',
                    color: 'var(--green-deep)', fontWeight: 600,
                  }}>
                    {trip.name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {isOrganizer && hasTeeTimes && (
                    <button
                      onClick={() => openAdd()}
                      style={{
                        padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none',
                        background: 'var(--green-deep)', color: 'var(--gold-light)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      + Add Tee Time
                    </button>
                  )}
                  <Link
                    href={`/trip/${id}`}
                    style={{ fontSize: '12px', color: 'var(--text-light)', textDecoration: 'none' }}
                  >
                    ← Trip
                  </Link>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '36px 48px', flex: 1, display: 'flex', flexDirection: 'column' }}>

                {!hasTeeTimes ? (
                  // Empty state
                  <EmptyState isOrganizer={isOrganizer} onAdd={() => openAdd()} />

                ) : (
                  <>
                    {/* Summary bar */}
                    <SummaryBar teeTimes={teeTimes} />

                    {/* Day sections */}
                    {tripDays.length > 0 ? (
                      <>
                        {tripDays.map(dateStr => (
                          <DaySection
                            key={dateStr}
                            dateStr={dateStr}
                            teeTimes={byDate[dateStr] ?? []}
                            isOrganizer={isOrganizer}
                            onAdd={() => openAdd(dateStr)}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                          />
                        ))}

                        {/* Extra tee times outside trip date range */}
                        {extraDates.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{
                              fontFamily: 'var(--font-serif)', fontSize: '15px',
                              color: 'var(--text-mid)', marginBottom: '16px', fontStyle: 'italic',
                            }}>
                              Outside Trip Dates
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {extraDates.flatMap(d => byDate[d]).map(tt => (
                                <TeeTimeCard
                                  key={tt.id}
                                  tt={tt}
                                  isOrganizer={isOrganizer}
                                  onEdit={openEdit}
                                  onDelete={handleDelete}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // No trip dates set — flat list grouped by date
                      <>
                        <div style={{
                          fontSize: '12px', color: 'var(--text-light)',
                          fontFamily: 'var(--font-sans)', marginBottom: '24px', fontStyle: 'italic',
                        }}>
                          Set trip start and end dates to organize by day.
                        </div>
                        {Object.keys(byDate).sort().map(dateStr => (
                          <DaySection
                            key={dateStr}
                            dateStr={dateStr}
                            teeTimes={byDate[dateStr]}
                            isOrganizer={isOrganizer}
                            onAdd={() => openAdd(dateStr)}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </>
                    )}
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
            setForm={setForm}
            tripCourses={tripCourses}
            saving={saving}
            onSave={handleSave}
            onClose={() => setDrawerOpen(false)}
          />
        )}

      </div>
    </ProtectedRoute>
  )
}
