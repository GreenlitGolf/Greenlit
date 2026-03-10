'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import InviteForm from '@/components/InviteForm'
import EditTripForm from '@/components/EditTripForm'
import Sidebar from '@/components/ui/Sidebar'
import type { NavItem } from '@/components/ui/Sidebar'
import CourseCard, { type CoursePickData } from '@/components/concierge/CourseCard'
import type { TripContext } from '@/app/api/concierge/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id:           string
  name:         string
  destination:  string | null
  start_date:   string | null
  end_date:     string | null
  invite_token: string
  created_by:   string
}

type Member = {
  user_id: string
  status:  string
  users:   { full_name: string | null; email: string } | null
}

type ChatMessage = {
  id:           string
  role:         'user' | 'assistant'
  content:      string       // displayed text (GREENLIT_PICKS stripped)
  rawContent?:  string       // full API response (preserved for conversation history)
  coursePicks?: CoursePickData[]
}

type ItineraryItem = {
  id:          string
  trip_id:     string
  day_number:  number
  start_time:  string | null
  title:       string
  description: string | null
  type:        'tee_time' | 'travel' | 'accommodation' | 'meal' | 'activity' | 'other'
  course_id:   string | null
  created_by:  string | null
  created_at:  string
}

type TripCourse = {
  course_id:   string | null
  course_name: string | null
  slug:        string | null
}

type ItineraryForm = {
  id?:         string
  day_number:  number
  start_time:  string
  title:       string
  description: string
  type:        ItineraryItem['type']
  course_id:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string | null) {
  if (!date) return 'TBD'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null
  const s = new Date(start + 'T12:00:00')
  const e = end ? new Date(end + 'T12:00:00') : null
  const sMonth = s.toLocaleDateString('en-US', { month: 'long' })
  const sDay   = s.getDate()
  const sYear  = s.getFullYear()
  if (!e) return `${sMonth} ${sDay}, ${sYear}`
  const eMonth = e.toLocaleDateString('en-US', { month: 'long' })
  const eDay   = e.getDate()
  const eYear  = e.getFullYear()
  if (sMonth === eMonth && sYear === eYear) return `${sMonth} ${sDay}–${eDay}, ${sYear}`
  if (sYear === eYear) return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear}`
  return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`
}

function buildTripMeta(start: string | null, end: string | null, count: number) {
  const parts: string[] = []
  if (start) {
    const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = end ? new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
    parts.push(e ? `${s} – ${e}` : `From ${s}`)
  }
  if (count > 0) parts.push(`${count} golfer${count !== 1 ? 's' : ''}`)
  return parts.join(' · ')
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function parseResponse(raw: string): { text: string; courses: CoursePickData[] } {
  const match = raw.match(/GREENLIT_PICKS:\s*([\s\S]*?)\s*END_PICKS/)
  let courses: CoursePickData[] = []
  if (match) {
    try { courses = JSON.parse(match[1].trim()) } catch { courses = [] }
  }
  const text = raw
    .replace(/GREENLIT_PICKS:[\s\S]*?END_PICKS/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, courses }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

/** Render inline **bold** and *italic* within a string of text. */
function renderInline(text: string, key: string | number): React.ReactNode {
  const parts: React.ReactNode[] = []
  // Match **bold** before *italic* to avoid partial overlap
  const regex = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${key}-b-${match.index}`} style={{ fontWeight: 600 }}>
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      parts.push(
        <em key={`${key}-i-${match.index}`} style={{ fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </em>,
      )
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

/**
 * Convert a simple markdown string to React nodes.
 * Handles: **bold**, *italic*, paragraph breaks (\n\n), and bullet lists (- item).
 */
function MarkdownText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/)

  return (
    <>
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim()
        if (!trimmed) return null

        const lines = trimmed.split('\n')
        const isList = lines.every((l) => /^[-*•]\s/.test(l.trim()))

        if (isList) {
          return (
            <ul
              key={pi}
              style={{
                margin:      pi > 0 ? '6px 0 0' : '0',
                paddingLeft: '18px',
                listStyle:   'disc',
              }}
            >
              {lines.map((line, li) => (
                <li key={li} style={{ marginBottom: '2px', lineHeight: 1.6 }}>
                  {renderInline(line.replace(/^[-*•]\s+/, ''), `${pi}-${li}`)}
                </li>
              ))}
            </ul>
          )
        }

        // Single-newline breaks within a paragraph → keep as line breaks
        const lineNodes = lines.map((line, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {renderInline(line, `${pi}-${li}`)}
          </React.Fragment>
        ))

        return (
          <p key={pi} style={{ margin: pi > 0 ? '8px 0 0' : '0', lineHeight: 1.7 }}>
            {lineNodes}
          </p>
        )
      })}
    </>
  )
}

const AVATAR_COLORS = ['#4a7c4a', '#c4a84f', '#6b9e6b', '#c8b89a', '#2d4a2d']

// ─── Itinerary constants & helpers ────────────────────────────────────────────

const TYPE_COLORS: Record<ItineraryItem['type'], string> = {
  tee_time:      '#c4a84f',
  travel:        '#7a8fa6',
  accommodation: '#2d5a3d',
  meal:          '#8b5e3c',
  activity:      '#6b8c6b',
  other:         '#9a9a9a',
}

const TYPE_LABELS: Record<ItineraryItem['type'], string> = {
  tee_time:      'TEE TIME',
  travel:        'TRAVEL',
  accommodation: 'ACCOMMODATION',
  meal:          'MEAL',
  activity:      'ACTIVITY',
  other:         'OTHER',
}

function getTripDays(start: string | null, end: string | null) {
  const base    = start ? new Date(start + 'T12:00:00') : new Date()
  const last    = end   ? new Date(end   + 'T12:00:00') : base
  const days: Array<{ date: Date; dayNum: number }> = []
  const cur     = new Date(base)
  let   n       = 1
  while (cur <= last) {
    days.push({ date: new Date(cur), dayNum: n })
    cur.setDate(cur.getDate() + 1)
    n++
  }
  return days.length > 0 ? days : [{ date: base, dayNum: 1 }]
}

function formatDayHeader(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function sortByTime(a: ItineraryItem, b: ItineraryItem) {
  if (!a.start_time && !b.start_time) return 0
  if (!a.start_time) return 1
  if (!b.start_time) return -1
  return a.start_time.localeCompare(b.start_time)
}

const itinLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--text-mid)', fontFamily: 'var(--font-sans)',
}

const itinInputStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--cream-dark)', background: 'var(--cream)',
  fontSize: '14px', color: 'var(--text-dark)', fontFamily: 'var(--font-sans)',
  fontWeight: 300, outline: 'none', width: '100%', boxSizing: 'border-box',
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'concierge', icon: '✦',  label: 'Golf Concierge',  href: '' },
  { id: 'itinerary', icon: '📅', label: 'Trip Itinerary',  href: '' },
  { id: 'teetimes',  icon: '🕐', label: 'Tee Times',       href: '' },
  { id: 'hotels',    icon: '🏨', label: 'Accommodations',  href: '' },
  { id: 'group',     icon: '👥', label: 'Group & Members', href: '' },
  { id: 'budget',    icon: '💰', label: 'Budget Tracker',  href: '' },
]

const SECTION_LABELS: Record<string, string> = {
  concierge: 'Golf Concierge',
  itinerary: 'Trip Itinerary',
  teetimes:  'Tee Times',
  hotels:    'Accommodations',
  group:     'Group & Members',
  budget:    'Budget Tracker',
}

// ─── Section: Golf Concierge ──────────────────────────────────────────────────

interface TripConciergeSectionProps {
  tripId:      string
  tripName:    string
  memberCount: number
  startDate:   string | null
  endDate:     string | null
}

function TripConciergeSection({
  tripId, tripName, memberCount, startDate, endDate,
}: TripConciergeSectionProps) {
  function makeWelcome(): ChatMessage {
    const ctxParts: string[] = []
    if (memberCount > 0) ctxParts.push(`${memberCount} golfer${memberCount !== 1 ? 's' : ''}`)
    const dateStr = formatDateRange(startDate, endDate)
    if (dateStr) ctxParts.push(dateStr)
    const ctx = ctxParts.length > 0 ? ` — ${ctxParts.join(', ')}` : ''
    return {
      id:      'welcome',
      role:    'assistant',
      content: `Welcome to ${tripName}${ctx}.\n\nTell me about the trip — where are you thinking, who's coming, and what kind of experience are you after?`,
    }
  }

  const [messages,      setMessages]      = useState<ChatMessage[]>(() => [makeWelcome()])
  const [input,         setInput]         = useState('')
  const [streaming,     setStreaming]      = useState(false)
  const [addedCourses,  setAddedCourses]  = useState<string[]>([])
  const [addedNotice,   setAddedNotice]   = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build trip context object for every API call
  function buildTripContext(): TripContext {
    const ctx: TripContext = { tripName }
    if (memberCount > 0)        ctx.memberCount  = memberCount
    if (startDate)              ctx.startDate    = startDate
    if (endDate)                ctx.endDate      = endDate
    if (addedCourses.length > 0) ctx.addedCourses = addedCourses
    return ctx
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }
    const history = [
      ...messages.filter((m) => m.id !== 'welcome'),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.rawContent ?? m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/concierge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages:    history,
          tripContext: buildTripContext(),
        }),
      })
      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   raw     = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value, { stream: true })

        const displayText = raw
          .replace(/GREENLIT_PICKS:[\s\S]*?(END_PICKS|$)/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: displayText } : m)
        )
      }

      const { text: finalText, courses } = parseResponse(raw)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: finalText, rawContent: raw, coursePicks: courses.length ? courses : undefined }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      )
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function handleAddToTrip(course: CoursePickData) {
    setAddedCourses((prev) =>
      prev.includes(course.name) ? prev : [...prev, course.name]
    )
    setAddedNotice(`"${course.name}" added to your trip.`)
    setTimeout(() => setAddedNotice(null), 4000)
  }

  return (
    <div style={{
      flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'var(--cream)',
    }}>

      {/* Added notice banner */}
      {addedNotice && (
        <div style={{
          background: 'var(--green-mid)', color: 'var(--gold-light)',
          padding: '10px 40px', fontSize: '13px', fontWeight: 400, flexShrink: 0,
        }}>
          {addedNotice}
        </div>
      )}

      {/* Start Fresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 40px 0', flexShrink: 0 }}>
        <button
          onClick={() => setMessages([makeWelcome()])}
          disabled={messages.length <= 1}
          style={{
            background:    'transparent',
            border:        'none',
            fontSize:      '11px',
            color:         'var(--text-light)',
            cursor:        messages.length <= 1 ? 'default' : 'pointer',
            fontFamily:    'var(--font-sans)',
            fontWeight:    400,
            letterSpacing: '0.03em',
            padding:       '2px 0',
            opacity:       messages.length <= 1 ? 0.3 : 0.6,
            transition:    'opacity 0.15s',
          }}
        >
          ↺ Start Fresh
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '28px 40px',
        display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  background: 'var(--green-deep)', color: 'var(--cream)',
                  padding: '12px 18px', borderRadius: '16px 16px 4px 16px',
                  maxWidth: '70%', fontSize: '14px', lineHeight: 1.6,
                  fontWeight: 300, whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', maxWidth: '82%' }}>
                {/* Avatar */}
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--green-mid), var(--green-light))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', flexShrink: 0, marginTop: '2px', color: 'var(--gold-light)',
                }}>
                  ✦
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {/* Text bubble */}
                  {msg.content && (
                    <div style={{
                      background: 'var(--white)', border: '1px solid var(--cream-dark)',
                      color: 'var(--text-dark)', padding: '12px 18px',
                      borderRadius: '4px 16px 16px 16px', fontSize: '14px',
                      fontWeight: 300, boxShadow: 'var(--shadow-subtle)',
                    }}>
                      <MarkdownText text={msg.content} />
                      {streaming && msg.id === messages[messages.length - 1]?.id && (
                        <span style={{
                          display: 'inline-block', width: '2px', height: '14px',
                          background: 'var(--green-light)', marginLeft: '2px',
                          verticalAlign: 'middle', animation: 'blink 1s step-end infinite',
                        }} />
                      )}
                    </div>
                  )}
                  {/* Course cards */}
                  {msg.coursePicks && msg.coursePicks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{
                        fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase',
                        color: 'var(--green-muted)', fontWeight: 600,
                      }}>
                        Greenlit Picks
                      </div>
                      {msg.coursePicks.map((course, i) => (
                        <CourseCard key={i} course={course} onAddToTrip={handleAddToTrip} tripId={tripId} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        background: 'var(--white)', borderTop: '1px solid var(--cream-dark)',
        padding: '16px 40px', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', gap: '12px', alignItems: 'flex-end',
          background: 'var(--cream)', border: '1px solid var(--cream-dark)',
          borderRadius: 'var(--radius-lg)', padding: '10px 14px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder='Ask about courses, or browse: "links courses in Scotland under $300"…'
            rows={1}
            style={{
              flex: 1, border: 'none', background: 'transparent', resize: 'none',
              outline: 'none', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-dark)',
              fontFamily: 'var(--font-sans)', fontWeight: 300,
              maxHeight: '100px', overflowY: 'auto',
            }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 100) + 'px'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: !input.trim() || streaming ? 'var(--cream-dark)' : 'var(--green-deep)',
              border: 'none',
              cursor: !input.trim() || streaming ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.2s',
              color: !input.trim() || streaming ? 'var(--text-light)' : 'var(--gold-light)',
              fontSize: '15px',
            }}
          >
            ↑
          </button>
        </div>
        <p style={{
          fontSize: '11px', color: 'var(--text-light)',
          textAlign: 'center', marginTop: '8px', fontWeight: 300,
        }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}

// ─── Section: Group & Members ─────────────────────────────────────────────────

function GroupSection({
  trip, members, isOrganizer, onEdit, onCopyLink, onRemoveMember, onLeaveTrip, copied, currentUserId,
}: {
  trip:           Trip
  members:        Member[]
  isOrganizer:    boolean
  onEdit:         () => void
  onCopyLink:     () => void
  onRemoveMember: (id: string) => void
  onLeaveTrip:    () => void
  copied:         boolean
  currentUserId:  string | undefined
}) {
  return (
    <div style={{ maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Trip card */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', overflow: 'hidden' }}>
        <div style={{ height: '6px', background: 'linear-gradient(90deg, var(--green-deep), var(--green-light))' }} />
        <div style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--green-muted)', marginBottom: '6px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Golf Trip</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--green-deep)', fontWeight: 600 }}>{trip.name}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px', fontWeight: 300, fontFamily: 'var(--font-sans)' }}>📍 {trip.destination ?? 'Destination TBD'}</p>
            </div>
            {isOrganizer && (
              <button onClick={onEdit} style={{ background: 'transparent', border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-sm)', padding: '7px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green-deep)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Edit
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--cream)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            {[['Start', trip.start_date], ['End', trip.end_date]].map(([label, date]) => (
              <div key={label}>
                <div style={{ fontSize: '10px', color: 'var(--text-light)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>{label}</div>
                <div style={{ fontSize: '14px', color: 'var(--green-deep)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>{formatDate(date as string | null)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Members */}
      {members.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: '24px 28px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--green-deep)', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--cream-dark)' }}>Members</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {members.map((m, i) => {
              const name = m.users?.full_name ?? m.users?.email ?? 'Unknown'
              return (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: i < members.length - 1 ? '1px solid var(--cream-dark)' : 'none' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: AVATAR_COLORS[i % AVATAR_COLORS.length] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--green-deep)', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                    {getInitials(name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--green-deep)', fontFamily: 'var(--font-sans)' }}>{name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 300, fontFamily: 'var(--font-sans)' }}>{m.users?.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '20px', fontWeight: 600, letterSpacing: '0.05em', fontFamily: 'var(--font-sans)', background: m.status === 'confirmed' ? 'rgba(74,124,74,0.15)' : 'rgba(196,168,79,0.15)', color: m.status === 'confirmed' ? 'var(--green-light)' : 'var(--gold)' }}>
                      {m.status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                    </span>
                    {isOrganizer && m.user_id !== currentUserId && (
                      <button onClick={() => onRemoveMember(m.user_id)} style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#c0392b', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Remove</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invite */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: '24px 28px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--green-deep)', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--cream-dark)' }}>Invite the Crew</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={onCopyLink} style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-dark)', background: copied ? 'rgba(74,124,74,0.1)' : 'var(--white)', color: copied ? 'var(--green-light)' : 'var(--text-mid)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}>
            {copied ? '✓ Invite link copied!' : 'Copy invite link'}
          </button>
          <InviteForm tripId={trip.id} />
        </div>
      </div>

      {/* Leave */}
      {!isOrganizer && (
        <button onClick={onLeaveTrip} style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(192,57,43,0.3)', background: 'transparent', color: '#c0392b', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Leave trip
        </button>
      )}
    </div>
  )
}

// ─── Section: Trip Itinerary ──────────────────────────────────────────────────

function TripItinerarySection({
  tripId, trip, memberCount, currentUserId,
}: {
  tripId:        string
  trip:          Trip
  memberCount:   number
  currentUserId: string | undefined
}) {
  const [items,        setItems]        = useState<ItineraryItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [generating,   setGenerating]   = useState(false)
  const [genError,     setGenError]     = useState<string | null>(null)
  const [tripCourses,  setTripCourses]  = useState<TripCourse[]>([])
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [drawerForm,   setDrawerForm]   = useState<ItineraryForm>({
    day_number: 1, start_time: '', title: '', description: '', type: 'other', course_id: '',
  })
  const [drawerSaving, setDrawerSaving] = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [regenConfirm, setRegenConfirm] = useState(false)
  const [genCount,     setGenCount]     = useState(0)

  const tripDays = getTripDays(trip.start_date, trip.end_date)

  useEffect(() => {
    fetchItems()
    fetchTripCourses()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', tripId)
    setItems(data || [])
    setLoading(false)
  }

  async function fetchTripCourses() {
    const { data: tcData } = await supabase
      .from('trip_courses')
      .select('course_id, course_name')
      .eq('trip_id', tripId)
    const tcs = tcData || []
    const courseIds = tcs.map((tc) => tc.course_id).filter(Boolean) as string[]
    if (courseIds.length > 0) {
      const { data: coursesData } = await supabase
        .from('courses').select('id, slug').in('id', courseIds)
      const slugMap: Record<string, string> = {}
      coursesData?.forEach((c) => { slugMap[c.id] = c.slug })
      setTripCourses(tcs.map((tc) => ({
        ...tc, slug: tc.course_id ? (slugMap[tc.course_id] ?? null) : null,
      })))
    } else {
      setTripCourses(tcs.map((tc) => ({ ...tc, slug: null })))
    }
  }

  function openDrawer(defaults?: Partial<ItineraryForm>) {
    setDrawerForm({
      day_number: 1, start_time: '', title: '', description: '', type: 'other', course_id: '',
      ...defaults,
    })
    setDrawerOpen(true)
  }

  function openDrawerForEdit(item: ItineraryItem) {
    setDrawerForm({
      id:          item.id,
      day_number:  item.day_number,
      start_time:  item.start_time  ?? '',
      title:       item.title,
      description: item.description ?? '',
      type:        item.type,
      course_id:   item.course_id   ?? '',
    })
    setDrawerOpen(true)
  }

  async function saveItem() {
    if (!drawerForm.title.trim()) return
    setDrawerSaving(true)
    const payload = {
      trip_id:     tripId,
      day_number:  drawerForm.day_number,
      start_time:  drawerForm.start_time  || null,
      title:       drawerForm.title.trim(),
      description: drawerForm.description.trim() || null,
      type:        drawerForm.type,
      course_id:   drawerForm.course_id || null,
      created_by:  currentUserId ?? null,
    }
    if (drawerForm.id) {
      const { data } = await supabase
        .from('itinerary_items').update(payload).eq('id', drawerForm.id).select().single()
      if (data) setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)))
    } else {
      const { data } = await supabase
        .from('itinerary_items').insert(payload).select().single()
      if (data) setItems((prev) => [...prev, data])
    }
    setDrawerSaving(false)
    setDrawerOpen(false)
  }

  async function deleteItem(id: string) {
    await supabase.from('itinerary_items').delete().eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setConfirmDelId(null)
  }

  async function generateItinerary() {
    setGenerating(true)
    setGenError(null)
    setRegenConfirm(false)
    try {
      const res = await fetch(`/api/trips/${tripId}/generate-itinerary`, { method: 'POST' })
      if (!res.ok) throw new Error('Generation failed')
      const data: ItineraryItem[] = await res.json()
      setItems(data)
      setGenCount((c) => c + 1)
    } catch {
      setGenError('Something went wrong generating the itinerary. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)' }}>
          Loading itinerary…
        </div>
      </div>
    )
  }

  const hasItems = items.length > 0

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '36px 48px' }}>

        {!hasItems ? (
          /* ── Empty state ── */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div style={{
              background: 'var(--white)', border: '1px solid var(--cream-dark)',
              borderRadius: 'var(--radius-lg)', padding: '56px 48px',
              textAlign: 'center', maxWidth: '480px', width: '100%',
              boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{
                fontSize: '32px', color: 'var(--gold)', marginBottom: '18px',
                lineHeight: 1,
              }}>
                ✦
              </div>
              <h2 style={{
                fontFamily: 'var(--font-serif)', fontSize: '24px',
                color: 'var(--green-deep)', marginBottom: '10px', fontWeight: 600,
              }}>
                Your itinerary is ready to be built
              </h2>
              <p style={{
                fontSize: '14px', color: 'var(--text-light)', fontWeight: 300,
                lineHeight: 1.7, marginBottom: '28px', fontFamily: 'var(--font-sans)',
              }}>
                Let the AI concierge build a starting point based on your trip, or start adding items manually.
              </p>
              {genError && (
                <div style={{
                  background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  fontSize: '13px', color: '#c0392b', marginBottom: '20px',
                }}>
                  {genError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={generateItinerary}
                  disabled={generating}
                  style={{
                    background: generating ? 'var(--cream-dark)' : 'var(--gold)',
                    color: generating ? 'var(--text-light)' : '#fff',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    padding: '12px 22px', fontSize: '14px', fontWeight: 600,
                    cursor: generating ? 'default' : 'pointer',
                    fontFamily: 'var(--font-sans)', letterSpacing: '0.03em',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  {generating ? (
                    <>
                      <span style={{ display: 'inline-block', animation: 'itin-spin 1s linear infinite' }}>◌</span>
                      Building your itinerary…
                    </>
                  ) : '✦ Generate with AI'}
                </button>
                <button
                  onClick={() => openDrawer({ day_number: 1 })}
                  style={{
                    background: 'transparent', color: 'var(--green-deep)',
                    border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-md)',
                    padding: '12px 22px', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  + Add Item Manually
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Day-by-day timeline ── */
          <>
            {/* Top actions */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              gap: '12px', marginBottom: '32px', flexWrap: 'wrap',
            }}>
              {genError && (
                <span style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'var(--font-sans)' }}>
                  {genError}
                </span>
              )}
              {regenConfirm ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--white)', border: '1px solid var(--cream-dark)',
                  borderRadius: 'var(--radius-md)', padding: '8px 14px',
                  fontSize: '13px', color: 'var(--text-mid)', fontFamily: 'var(--font-sans)',
                }}>
                  <span>Overwrite current itinerary?</span>
                  <button
                    onClick={generateItinerary}
                    disabled={generating}
                    style={{
                      color: '#c0392b', background: 'transparent', border: 'none',
                      fontWeight: 600, cursor: 'pointer', fontSize: '13px',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {generating ? 'Generating…' : 'Yes, regenerate'}
                  </button>
                  <span style={{ color: 'var(--cream-dark)' }}>·</span>
                  <button
                    onClick={() => setRegenConfirm(false)}
                    style={{
                      color: 'var(--text-light)', background: 'transparent', border: 'none',
                      cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRegenConfirm(true)}
                  style={{
                    background: 'transparent', color: 'var(--text-mid)',
                    border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-md)',
                    padding: '9px 16px', fontSize: '12px', fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.03em',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  ✦ Regenerate Itinerary
                </button>
              )}
              <button
                onClick={() => openDrawer()}
                style={{
                  background: 'var(--gold)', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  padding: '9px 18px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                + Add Item
              </button>
            </div>

            {/* Timeline — keyed on genCount so cards re-animate after generation */}
            <div key={`timeline-${genCount}`}>
              {tripDays.map(({ date, dayNum }) => {
                const dayItems = items
                  .filter((i) => i.day_number === dayNum)
                  .sort(sortByTime)

                return (
                  <div key={dayNum} style={{ marginBottom: '44px' }}>

                    {/* Day header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px',
                    }}>
                      <h3 style={{
                        fontFamily: 'var(--font-serif)', fontSize: '20px',
                        color: 'var(--green-deep)', fontWeight: 600, whiteSpace: 'nowrap',
                        margin: 0,
                      }}>
                        Day {dayNum} — {formatDayHeader(date)}
                      </h3>
                      <div style={{ flex: 1, height: '1px', background: 'var(--cream-dark)' }} />
                    </div>

                    {/* Items */}
                    {dayItems.length > 0 ? (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px',
                      }}>
                        {dayItems.map((item, idx) => {
                          const clr    = TYPE_COLORS[item.type]
                          const isDeleting = confirmDelId === item.id
                          const linkedCourse = item.course_id
                            ? tripCourses.find((tc) => tc.course_id === item.course_id)
                            : undefined

                          return (
                            <div
                              key={item.id}
                              className="itin-card"
                              style={{
                                display: 'flex', background: 'var(--white)',
                                borderRadius: 'var(--radius-md)', overflow: 'hidden',
                                border: '1px solid var(--cream-dark)',
                                boxShadow: 'var(--shadow-subtle)',
                                animation: 'itin-fadeUp 0.4s ease both',
                                animationDelay: `${idx * 55}ms`,
                              }}
                            >
                              {/* Type colour bar */}
                              <div style={{ width: '4px', background: clr, flexShrink: 0 }} />

                              {/* Content */}
                              <div style={{
                                flex: 1, padding: '14px 16px',
                                display: 'flex', gap: '16px', alignItems: 'flex-start',
                              }}>
                                {/* Time */}
                                <div style={{
                                  width: '68px', flexShrink: 0, fontSize: '11px',
                                  color: 'var(--text-light)', fontFamily: 'var(--font-sans)',
                                  fontWeight: 600, letterSpacing: '0.05em',
                                  textTransform: 'uppercase', paddingTop: '2px',
                                }}>
                                  {item.start_time || '—'}
                                </div>

                                {/* Main */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    display: 'flex', alignItems: 'center',
                                    gap: '10px', flexWrap: 'wrap',
                                    marginBottom: item.description ? '4px' : 0,
                                  }}>
                                    <span style={{
                                      fontSize: '14px', fontWeight: 500,
                                      color: 'var(--green-deep)', fontFamily: 'var(--font-sans)',
                                    }}>
                                      {item.title}
                                    </span>
                                    <span style={{
                                      fontSize: '9px', padding: '2px 8px',
                                      borderRadius: '20px', fontWeight: 700,
                                      letterSpacing: '0.1em', fontFamily: 'var(--font-sans)',
                                      background: `${clr}18`, color: clr,
                                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                                    }}>
                                      {TYPE_LABELS[item.type]}
                                    </span>
                                    {linkedCourse?.slug && (
                                      <Link
                                        href={`/course/${linkedCourse.slug}`}
                                        style={{
                                          fontSize: '11px', color: 'var(--gold)',
                                          textDecoration: 'none', fontFamily: 'var(--font-sans)',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {linkedCourse.course_name} →
                                      </Link>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p style={{
                                      fontSize: '13px', color: 'var(--text-light)',
                                      fontWeight: 300, lineHeight: 1.6, margin: 0,
                                      fontFamily: 'var(--font-sans)',
                                    }}>
                                      {item.description}
                                    </p>
                                  )}
                                </div>

                                {/* Actions */}
                                <div style={{
                                  display: 'flex', alignItems: 'center',
                                  gap: '4px', flexShrink: 0,
                                }}>
                                  {isDeleting ? (
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: '8px',
                                      fontSize: '12px', color: 'var(--text-mid)',
                                      fontFamily: 'var(--font-sans)',
                                    }}>
                                      <span>Delete?</span>
                                      <button
                                        onClick={() => deleteItem(item.id)}
                                        style={{
                                          color: '#c0392b', background: 'transparent',
                                          border: 'none', cursor: 'pointer',
                                          fontWeight: 600, fontSize: '12px',
                                          fontFamily: 'var(--font-sans)',
                                        }}
                                      >
                                        Yes
                                      </button>
                                      <span style={{ color: 'var(--cream-dark)' }}>·</span>
                                      <button
                                        onClick={() => setConfirmDelId(null)}
                                        style={{
                                          color: 'var(--text-light)', background: 'transparent',
                                          border: 'none', cursor: 'pointer',
                                          fontSize: '12px', fontFamily: 'var(--font-sans)',
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => openDrawerForEdit(item)}
                                        className="itin-icon-btn"
                                        title="Edit"
                                        style={{
                                          background: 'transparent', border: 'none',
                                          cursor: 'pointer', color: 'var(--text-light)',
                                          padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                          fontSize: '13px', opacity: 0,
                                          transition: 'opacity 0.15s, color 0.15s, background 0.15s',
                                        }}
                                      >
                                        ✏
                                      </button>
                                      <button
                                        onClick={() => setConfirmDelId(item.id)}
                                        className="itin-icon-btn"
                                        title="Delete"
                                        style={{
                                          background: 'transparent', border: 'none',
                                          cursor: 'pointer', color: 'var(--text-light)',
                                          padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                          fontSize: '13px', opacity: 0,
                                          transition: 'opacity 0.15s, color 0.15s, background 0.15s',
                                        }}
                                      >
                                        🗑
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{
                        padding: '14px 18px', borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--cream-dark)', marginBottom: '12px',
                        fontSize: '13px', color: 'var(--text-light)',
                        fontStyle: 'italic', fontFamily: 'var(--font-sans)',
                      }}>
                        No items planned for this day yet.
                      </div>
                    )}

                    {/* Add to day */}
                    <button
                      onClick={() => openDrawer({ day_number: dayNum })}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--gold)', fontSize: '13px', fontWeight: 500,
                        fontFamily: 'var(--font-sans)', padding: '4px 0',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      + Add to Day {dayNum}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50,
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px',
            background: 'var(--white)', zIndex: 51,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
            animation: 'itin-slideIn 0.22s ease',
          }}>
            {/* Drawer header */}
            <div style={{
              padding: '24px 28px 18px', borderBottom: '1px solid var(--cream-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '20px',
                color: 'var(--green-deep)', fontWeight: 600,
              }}>
                {drawerForm.id ? 'Edit Item' : 'Add Item'}
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'transparent', border: 'none',
                  fontSize: '22px', cursor: 'pointer',
                  color: 'var(--text-light)', lineHeight: 1, padding: '0 2px',
                }}
              >
                ×
              </button>
            </div>

            {/* Drawer form */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '24px 28px',
              display: 'flex', flexDirection: 'column', gap: '18px',
            }}>
              {/* Day */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={itinLabelStyle}>Day</span>
                <select
                  value={drawerForm.day_number}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, day_number: Number(e.target.value) }))}
                  style={itinInputStyle}
                >
                  {tripDays.map(({ date, dayNum }) => (
                    <option key={dayNum} value={dayNum}>
                      Day {dayNum} — {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </option>
                  ))}
                </select>
              </label>

              {/* Type */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={itinLabelStyle}>Type</span>
                <select
                  value={drawerForm.type}
                  onChange={(e) => setDrawerForm((f) => ({
                    ...f,
                    type:      e.target.value as ItineraryItem['type'],
                    course_id: '',
                  }))}
                  style={itinInputStyle}
                >
                  {(Object.entries(TYPE_LABELS) as [ItineraryItem['type'], string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              {/* Time */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={itinLabelStyle}>Time (optional)</span>
                <input
                  type="text"
                  placeholder="8:00 AM"
                  value={drawerForm.start_time}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, start_time: e.target.value }))}
                  style={itinInputStyle}
                />
              </label>

              {/* Title */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={itinLabelStyle}>Title *</span>
                <input
                  type="text"
                  placeholder="e.g. Morning round at Pacific Dunes"
                  value={drawerForm.title}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, title: e.target.value }))}
                  style={itinInputStyle}
                />
              </label>

              {/* Description */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={itinLabelStyle}>Description (optional)</span>
                <textarea
                  placeholder="Add details…"
                  value={drawerForm.description}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ ...itinInputStyle, resize: 'vertical' }}
                />
              </label>

              {/* Course — only for tee_time */}
              {drawerForm.type === 'tee_time' && tripCourses.length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={itinLabelStyle}>Course (from this trip)</span>
                  <select
                    value={drawerForm.course_id}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, course_id: e.target.value }))}
                    style={itinInputStyle}
                  >
                    <option value="">— None —</option>
                    {tripCourses.map((tc) =>
                      tc.course_id ? (
                        <option key={tc.course_id} value={tc.course_id}>
                          {tc.course_name}
                        </option>
                      ) : null,
                    )}
                  </select>
                </label>
              )}
            </div>

            {/* Drawer footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid var(--cream-dark)', flexShrink: 0 }}>
              <button
                onClick={saveItem}
                disabled={drawerSaving || !drawerForm.title.trim()}
                style={{
                  width: '100%', padding: '13px',
                  background: !drawerForm.title.trim() || drawerSaving
                    ? 'var(--cream-dark)' : 'var(--green-deep)',
                  color: !drawerForm.title.trim() || drawerSaving
                    ? 'var(--text-light)' : 'var(--gold-light)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '14px', fontWeight: 600,
                  cursor: !drawerForm.title.trim() || drawerSaving ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                }}
              >
                {drawerSaving ? 'Saving…' : 'Save Item'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes itin-spin    { from { transform: rotate(0deg)  } to { transform: rotate(360deg) } }
        @keyframes itin-fadeUp  { from { opacity: 0; transform: translateY(8px)  } to { opacity: 1; transform: translateY(0) } }
        @keyframes itin-slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        .itin-card:hover .itin-icon-btn { opacity: 1 !important; }
        .itin-icon-btn:hover { color: var(--green-deep) !important; background: var(--cream) !important; }
      `}</style>
    </>
  )
}

// ─── Section: Coming Soon ─────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 40px', background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', maxWidth: '480px' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚧</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--green-deep)', marginBottom: '8px' }}>{label}</div>
      <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, fontFamily: 'var(--font-sans)' }}>This feature is coming soon.</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripPage() {
  const { id }      = useParams()
  const { session } = useAuth()
  const router      = useRouter()

  const [trip,      setTrip]      = useState<Trip | null>(null)
  const [members,   setMembers]   = useState<Member[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [copied,    setCopied]    = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [activeNav, setActiveNav] = useState('concierge')

  const isOrganizer = trip?.created_by === session?.user.id

  useEffect(() => {
    async function fetchTrip() {
      const { data, error } = await supabase.from('trips').select('*').eq('id', id).single()
      if (error) { setError('Trip not found.'); setLoading(false); return }
      setTrip(data)

      const { data: memberRows } = await supabase
        .from('trip_members').select('user_id, status').eq('trip_id', id)
      if (memberRows && memberRows.length > 0) {
        const userIds = memberRows.map((m) => m.user_id)
        const { data: userData } = await supabase
          .from('users').select('id, full_name, email').in('id', userIds)
        setMembers(memberRows.map((m) => ({
          ...m, users: userData?.find((u) => u.id === m.user_id) ?? null,
        })))
      }
      setLoading(false)
    }
    if (id) fetchTrip()
  }, [id])

  function copyInviteLink() {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    navigator.clipboard.writeText(`${base}/join/${trip?.invite_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRemoveMember(userId: string) {
    await supabase.from('trip_members').delete().eq('trip_id', id).eq('user_id', userId)
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
  }

  async function handleLeaveTrip() {
    if (!session) return
    await supabase.from('trip_members').delete().eq('trip_id', id).eq('user_id', session.user.id)
    router.push('/dashboard')
  }

  const sidebarMembers = members.map((m, i) => ({
    initials: getInitials(m.users?.full_name ?? m.users?.email ?? '?'),
    color:    AVATAR_COLORS[i % AVATAR_COLORS.length],
  }))

  const isConcierge = activeNav === 'concierge'
  const isItinerary = activeNav === 'itinerary'
  const isFullHeight = isConcierge || isItinerary

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)', background: 'var(--cream)' }}>

        {/* Sidebar */}
        {trip && (
          <Sidebar
            navItems={NAV_ITEMS}
            activeId={activeNav}
            onItemClick={(id) => { setEditing(false); setActiveNav(id) }}
            tripName={trip.name}
            tripMeta={buildTripMeta(trip.start_date, trip.end_date, members.length)}
            groupName="The Crew"
            members={sidebarMembers}
          />
        )}

        {/* Main column */}
        <div style={{
          flex: 1,
          overflowY:     isFullHeight ? 'hidden' : 'auto',
          display:       'flex',
          flexDirection: 'column',
        }}>

          {loading && (
            <div style={{ padding: '80px', textAlign: 'center', fontSize: '13px', color: 'var(--text-light)' }}>Loading…</div>
          )}

          {error && (
            <div style={{ padding: '80px', textAlign: 'center', fontSize: '13px', color: '#c0392b' }}>
              {error}<br />
              <Link href="/dashboard" style={{ color: 'var(--green-light)', textDecoration: 'none', marginTop: '12px', display: 'inline-block' }}>← Back to dashboard</Link>
            </div>
          )}

          {trip && !editing && (
            <>
              {/* Page header */}
              <div style={{
                padding:        '24px 48px 18px',
                borderBottom:   '1px solid var(--cream-dark)',
                background:     'var(--white)',
                position:       isFullHeight ? 'relative' : 'sticky',
                top:            0, zIndex: 10,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                flexShrink:     0,
              }}>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--green-light)', fontWeight: 600, marginBottom: '3px' }}>
                    {SECTION_LABELS[activeNav]}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--green-deep)', fontWeight: 600 }}>
                    {trip.name}
                  </div>
                </div>
                <Link href="/dashboard" style={{ fontSize: '12px', color: 'var(--text-light)', textDecoration: 'none', fontWeight: 400 }}>
                  ← Dashboard
                </Link>
              </div>

              {/* Section routing */}
              {isConcierge ? (
                <TripConciergeSection
                  tripId={trip.id}
                  tripName={trip.name}
                  memberCount={members.length}
                  startDate={trip.start_date}
                  endDate={trip.end_date}
                />
              ) : isItinerary ? (
                <TripItinerarySection
                  tripId={trip.id}
                  trip={trip}
                  memberCount={members.length}
                  currentUserId={session?.user.id}
                />
              ) : (
                <div style={{ padding: '36px 48px' }}>
                  {activeNav === 'group' ? (
                    <GroupSection
                      trip={trip}
                      members={members}
                      isOrganizer={isOrganizer}
                      onEdit={() => setEditing(true)}
                      onCopyLink={copyInviteLink}
                      onRemoveMember={handleRemoveMember}
                      onLeaveTrip={handleLeaveTrip}
                      copied={copied}
                      currentUserId={session?.user.id}
                    />
                  ) : (
                    <ComingSoon label={SECTION_LABELS[activeNav]} />
                  )}
                </div>
              )}
            </>
          )}

          {trip && editing && (
            <div style={{ padding: '40px 48px', maxWidth: '560px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', color: 'var(--green-deep)', marginBottom: '24px' }}>Edit Trip</div>
              <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: '28px' }}>
                <EditTripForm
                  trip={trip}
                  onSave={(updated) => { setTrip({ ...trip, ...updated }); setEditing(false) }}
                  onCancel={() => setEditing(false)}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  )
}
