'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import EditTripForm from '@/components/EditTripForm'
import Sidebar from '@/components/ui/Sidebar'
import type { NavItem } from '@/components/ui/Sidebar'
import CourseCard, { type CoursePickData } from '@/components/concierge/CourseCard'
import type { TripContext }       from '@/app/api/concierge/route'
import GroupDecisionsSection      from '@/components/trip/GroupDecisionsSection'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id:           string
  name:         string
  destination:  string | null
  start_date:   string | null
  end_date:     string | null
  invite_token: string
  created_by:   string
  share_token:  string | null
}

type TripMember = {
  id:           number
  user_id:      string | null
  display_name: string | null
  email:        string | null
  handicap:     number | null
  role:         string
  member_type:  string
  invite_status: string
  status:       string
  invite_token: string | null
  users:        { full_name: string | null; email: string | null; avatar_url: string | null } | null
}

type ChatMessage = {
  id:           string
  role:         'user' | 'assistant'
  content:      string
  rawContent?:  string       // kept for backward compat
  coursePicks?: CoursePickData[]  // legacy field from old streaming format
  courses?:     CoursePickData[]  // current field populated from API JSON response
  loading?:     boolean      // true while awaiting API response
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
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
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
    const s = new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const e = end ? new Date(end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
    parts.push(e ? `${s} – ${e}` : `From ${s}`)
  }
  if (count > 0) parts.push(`${count} golfer${count !== 1 ? 's' : ''}`)
  return parts.join(' · ')
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// Maps a DB MatchedCourse to the CoursePickData shape used by CourseCard
function dbCourseToPick(c: {
  id: string; slug: string; name: string; location: string
  tags: string[]; price_min: number | null; price_max: number | null
  emoji: string; google_place_id: string | null
}): CoursePickData {
  const price = c.price_min && c.price_max
    ? `$${c.price_min}–$${c.price_max}/person est.`
    : c.price_min ? `From $${c.price_min}/person est.` : 'Contact for rates'
  return {
    name:           c.name,
    location:       c.location,
    price,
    emoji:          c.emoji || '⛳',
    tags:           c.tags ?? [],
    courseId:       c.slug,
    courseUUID:     c.id,
    googlePlaceId:  c.google_place_id ?? undefined,
  }
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

function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (!match) return 0
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + m
}

function sortByTime(a: ItineraryItem, b: ItineraryItem) {
  if (!a.start_time && !b.start_time) return 0
  if (!a.start_time) return 1
  if (!b.start_time) return -1
  return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
}

/** Strip " - Round N" suffix from tee time titles */
function stripRoundSuffix(title: string): string {
  return title.replace(/\s*[-–—]\s*Round\s*\d+$/i, '').trim()
}

type GroupedItineraryItem = {
  kind: 'single'
  item: ItineraryItem
} | {
  kind: 'tee_time_group'
  courseName: string
  items: ItineraryItem[]
  firstTime: string | null
  courseId: string | null
}

/** Group consecutive tee_time items that share the same course (after stripping round suffix) */
function groupDayItems(dayItems: ItineraryItem[]): GroupedItineraryItem[] {
  const result: GroupedItineraryItem[] = []
  let i = 0
  while (i < dayItems.length) {
    const item = dayItems[i]
    if (item.type === 'tee_time') {
      const courseName = stripRoundSuffix(item.title)
      const group: ItineraryItem[] = [item]
      let j = i + 1
      while (j < dayItems.length && dayItems[j].type === 'tee_time' && stripRoundSuffix(dayItems[j].title) === courseName) {
        group.push(dayItems[j])
        j++
      }
      result.push({
        kind: 'tee_time_group',
        courseName,
        items: group,
        firstTime: group[0].start_time,
        courseId: group[0].course_id,
      })
      i = j
    } else {
      result.push({ kind: 'single', item })
      i++
    }
  }
  return result
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

function buildNavItems(memberCount: number): NavItem[] {
  return [
    { id: 'concierge',  icon: '✦',  label: 'Golf Concierge',   href: '' },
    { id: 'tripcourses',icon: '⛳', label: 'Trip Courses',      href: '' },
    { id: 'itinerary',  icon: '📅', label: 'Trip Itinerary',    href: '' },
    { id: 'games',      icon: '🎲', label: 'Golf Games',        href: '' },
    { id: 'teetimes',   icon: '🕐', label: 'Tee Times',         href: '' },
    { id: 'hotels',     icon: '🏨', label: 'Accommodations',    href: '' },
    { id: 'group',      icon: '👥', label: 'Group & Members',   href: '', badge: memberCount > 0 ? memberCount : undefined },
    { id: 'decisions',  icon: '🗳️', label: 'Group Decisions',   href: '' },
    { id: 'budget',     icon: '💰', label: 'Budget Tracker',    href: '' },
    { id: 'report',     icon: '📄', label: 'Trip Report',       href: '', section: 'Share' },
  ]
}

const SECTION_LABELS: Record<string, string> = {
  concierge:   'Golf Concierge',
  tripcourses: 'Trip Courses',
  itinerary:   'Trip Itinerary',
  games:       'Golf Games',
  teetimes:    'Tee Times',
  hotels:      'Accommodations',
  group:       'Group & Members',
  decisions:   'Group Decisions',
  budget:      'Budget Tracker',
  report:      'Trip Report',
}

// ─── Section: Golf Concierge ──────────────────────────────────────────────────

interface TripConciergeSectionProps {
  tripId:        string
  tripName:      string
  memberCount:   number
  handicapRange: string | null
  startDate:     string | null
  endDate:       string | null
}

function TripConciergeSection({
  tripId, tripName, memberCount, handicapRange, startDate, endDate,
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

  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [input,        setInput]        = useState('')
  const [streaming,    setStreaming]     = useState(false)
  const [addedCourses, setAddedCourses] = useState<string[]>([])
  const [addedNotice,  setAddedNotice]  = useState<string | null>(null)
  const [enrichNotices, setEnrichNotices] = useState<Record<string, {
    name: string; status: 'loading' | 'done' | 'queued' | 'private'; slug?: string
  }>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Load persisted messages from Supabase on mount
  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from('concierge_messages')
        .select('id, role, content, created_at')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        setMessages(
          data.map((row) => ({
            id:      row.id,
            role:    row.role as 'user' | 'assistant',
            content: row.content,
          }))
        )
      } else {
        // No prior history — show the welcome message but don't persist it
        setMessages([makeWelcome()])
      }
    }
    loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build trip context object for every API call
  function buildTripContext(): TripContext {
    const ctx: TripContext = { tripName }
    if (memberCount > 0)        ctx.memberCount   = memberCount
    if (handicapRange)          ctx.handicapRange = handicapRange
    if (startDate)              ctx.startDate     = startDate
    if (endDate)                ctx.endDate       = endDate
    if (addedCourses.length > 0) ctx.addedCourses = addedCourses
    return ctx
  }

  async function persistMessage(role: 'user' | 'assistant', content: string) {
    await supabase
      .from('concierge_messages')
      .insert({ trip_id: tripId, role, content })
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }
    const history = [
      ...messages.filter((m) => m.id !== 'welcome'),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Persist user message immediately
    await persistMessage('user', text)

    // Add a loading placeholder for the assistant reply
    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', loading: true }])

    try {
      const res = await fetch('/api/concierge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages:    history,
          tripContext: buildTripContext(),
        }),
      })
      if (!res.ok) throw new Error('Request failed')

      const data: { message: string; courses?: Array<{
        id: string; slug: string; name: string; location: string
        tags: string[]; price_min: number | null; price_max: number | null
        emoji: string; google_place_id: string | null
      }> } = await res.json()

      // Check for ENRICH_COURSE marker in the message text
      const enrichMatch = data.message.match(
        /\[ENRICH_COURSE:\s*"([^"]+)"\s*\|\s*"([^"]+)"\s*\|\s*"([^"]+)"\s*\]/,
      )
      const finalText = data.message
        .replace(/\[ENRICH_COURSE:[^\]]*\]/g, '')
        .trim()

      const mappedCourses: CoursePickData[] = (data.courses ?? []).map(dbCourseToPick)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: finalText, loading: false, courses: mappedCourses.length ? mappedCourses : undefined }
            : m
        )
      )

      // Fire background enrichment if marker was found
      if (enrichMatch) {
        const [, courseName, courseLocation, courseCountry] = enrichMatch
        triggerEnrichment(assistantId, courseName, courseLocation, courseCountry)
      }

      // Persist assistant reply
      await persistMessage('assistant', finalText)
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.', loading: false }
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

  async function handleAddToTrip(course: CoursePickData) {
    if (!course.courseUUID) {
      // Fallback: course not in DB yet — just track locally until it's enriched
      setAddedCourses((prev) => prev.includes(course.name) ? prev : [...prev, course.name])
      setAddedNotice(`${course.name} noted — it's being added to the Greenlit database.`)
      setTimeout(() => setAddedNotice(null), 4000)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/trips/${tripId}/courses`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ courseId: course.courseUUID }),
      })

      if (res.ok) {
        setAddedCourses((prev) => prev.includes(course.name) ? prev : [...prev, course.name])
        setAddedNotice(`${course.name} added to your trip ✓`)
        setTimeout(() => setAddedNotice(null), 4000)
      }
    } catch {
      // Silently fail — button state will remain un-added so user can retry
    }
  }

  async function triggerEnrichment(msgId: string, name: string, location: string, country: string) {
    setEnrichNotices((prev) => ({ ...prev, [msgId]: { name, status: 'loading' } }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/courses/enrich-on-demand', {
        method : 'POST',
        headers: {
          'Content-Type' : 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ name, location, country }),
      })
      const data = await res.json()
      if (data.status === 'complete' || data.status === 'exists') {
        setEnrichNotices((prev) => ({ ...prev, [msgId]: { name, status: 'done', slug: data.slug } }))
      } else if (data.status === 'private') {
        setEnrichNotices((prev) => ({ ...prev, [msgId]: { name, status: 'private' } }))
      } else {
        setEnrichNotices((prev) => ({ ...prev, [msgId]: { name, status: 'queued' } }))
      }
    } catch {
      setEnrichNotices((prev) => ({ ...prev, [msgId]: { name, status: 'queued' } }))
    }
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
          onClick={async () => {
            await supabase.from('concierge_messages').delete().eq('trip_id', tripId)
            setMessages([makeWelcome()])
          }}
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
                  {/* Text bubble — or typing dots while loading */}
                  <div style={{
                    background: 'var(--white)', border: '1px solid var(--cream-dark)',
                    color: 'var(--text-dark)', padding: '12px 18px',
                    borderRadius: '4px 16px 16px 16px', fontSize: '14px',
                    fontWeight: 300, boxShadow: 'var(--shadow-subtle)',
                  }}>
                    {msg.loading ? (
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '2px 0' }}>
                        {[0, 1, 2].map((i) => (
                          <span key={i} style={{
                            display: 'inline-block', width: '7px', height: '7px',
                            borderRadius: '50%', background: 'var(--green-light)',
                            animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <MarkdownText text={msg.content} />
                    )}
                  </div>
                  {/* Course cards — from new JSON response or legacy coursePicks */}
                  {(() => {
                    const picks = msg.courses ?? msg.coursePicks
                    if (!picks || picks.length === 0) return null
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{
                          fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase',
                          color: 'var(--green-muted)', fontWeight: 600,
                        }}>
                          Greenlit Picks
                        </div>
                        {picks.map((course, i) => (
                          <CourseCard key={i} course={course} onAddToTrip={handleAddToTrip} tripId={tripId} />
                        ))}
                      </div>
                    )
                  })()}

                  {/* Enrichment notice */}
                  {enrichNotices[msg.id] && (() => {
                    const n = enrichNotices[msg.id]
                    return (
                      <div style={{
                        fontSize     : '12px',
                        color        : n.status === 'done' ? 'var(--green-light)' : 'var(--text-light)',
                        display      : 'flex',
                        alignItems   : 'center',
                        gap          : '6px',
                        fontWeight   : 300,
                        paddingLeft  : '2px',
                      }}>
                        {n.status === 'loading' && (
                          <><span style={{ opacity: 0.7 }}>✦</span> Adding {n.name} to the Greenlit database…</>
                        )}
                        {n.status === 'queued' && (
                          <><span style={{ opacity: 0.7 }}>✦</span> {n.name} is being researched — full details coming soon</>
                        )}
                        {n.status === 'private' && (
                          <><span style={{ opacity: 0.5 }}>🔒</span> {n.name} appears to be a private club</>
                        )}
                        {n.status === 'done' && n.slug && (
                          <><span>✦</span> {n.name} has been added —{' '}
                            <a
                              href={`/course/${n.slug}`}
                              style={{ color: 'var(--gold)', fontWeight: 500, textDecoration: 'none' }}
                            >
                              View Course →
                            </a>
                          </>
                        )}
                      </div>
                    )
                  })()}
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

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Section: Group & Members ─────────────────────────────────────────────────

function getMemberName(m: TripMember): string {
  return m.users?.full_name ?? m.display_name ?? m.users?.email ?? m.email ?? 'Unknown'
}

function getMemberStatus(m: TripMember): { text: string; bg: string; color: string } {
  if (m.member_type === 'registered' || m.invite_status === 'accepted') {
    return { text: '✓ Joined', bg: 'rgba(74,124,74,0.12)', color: '#4a7c4a' }
  }
  if (m.invite_status === 'pending') {
    return { text: '✉ Invited', bg: 'rgba(196,168,79,0.15)', color: '#b59a3c' }
  }
  return { text: 'Not invited', bg: 'var(--cream)', color: 'var(--text-light)' }
}

function GroupSection({
  tripId, trip, members, isOrganizer, onEdit, onCopyLink, onLeaveTrip, onMembersChange, currentUserId,
}: {
  tripId:          string
  trip:            Trip
  members:         TripMember[]
  isOrganizer:     boolean
  onEdit:          () => void
  onCopyLink:      () => void
  onLeaveTrip:     () => void
  onMembersChange: (members: TripMember[]) => void
  currentUserId:   string | undefined
}) {
  const [addForm,      setAddForm]      = useState({ display_name: '', handicap: '', email: '' })
  const [addSaving,    setAddSaving]    = useState(false)
  const [addError,     setAddError]     = useState('')
  const [editingHcpId, setEditingHcpId] = useState<number | null>(null)
  const [hcpDraft,     setHcpDraft]     = useState('')
  const [menuOpenId,   setMenuOpenId]   = useState<number | null>(null)
  const [invitingId,   setInvitingId]   = useState<number | null>(null)
  const [copied,       setCopied]       = useState(false)

  const nonSelfCount = members.filter((m) => !(m.role === 'organizer' && m.user_id === currentUserId)).length
  const isEmpty = nonSelfCount === 0

  async function handleAdd() {
    if (!addForm.display_name.trim()) return
    setAddSaving(true); setAddError('')
    const res = await fetch(`/api/trips/${tripId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: addForm.display_name.trim(),
        handicap: addForm.handicap ? Number(addForm.handicap) : null,
        email: addForm.email.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAddError(data.error ?? 'Error adding member')
    } else {
      onMembersChange([...members, { ...data, users: null }])
      setAddForm({ display_name: '', handicap: '', email: '' })
    }
    setAddSaving(false)
  }

  async function handleRemove(memberId: number) {
    setMenuOpenId(null)
    await fetch(`/api/trips/${tripId}/members/${memberId}`, { method: 'DELETE' })
    onMembersChange(members.filter((m) => m.id !== memberId))
  }

  async function saveHcp(memberId: number) {
    const hcp = hcpDraft.trim() === '' ? null : Number(hcpDraft)
    setEditingHcpId(null)
    await fetch(`/api/trips/${tripId}/members/${memberId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handicap: hcp }),
    })
    onMembersChange(members.map((m) => m.id === memberId ? { ...m, handicap: hcp } : m))
  }

  async function sendInvite(m: TripMember) {
    setInvitingId(m.id); setMenuOpenId(null)
    await fetch(`/api/trips/${tripId}/members/${m.id}/send-invite`, { method: 'POST' })
    onMembersChange(members.map((mem) => mem.id === m.id ? { ...mem, invite_status: 'pending' } : mem))
    setInvitingId(null)
  }

  function copyLink() {
    onCopyLink()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--cream-dark)', background: 'var(--cream)',
    fontSize: '13px', color: 'var(--text-dark)', fontFamily: 'var(--font-sans)', outline: 'none',
  }

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 700, margin: '0 0 4px' }}>
            The Crew
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, margin: 0, fontFamily: 'var(--font-sans)' }}>
            {members.length} golfer{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isOrganizer && (
          <button onClick={onEdit} style={{ background: 'transparent', border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-sm)', padding: '7px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green-deep)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Edit Trip
          </button>
        )}
      </div>

      {/* Member cards */}
      {members.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', overflow: 'hidden' }}>
          {members.map((m, i) => {
            const name     = getMemberName(m)
            const isLast   = i === members.length - 1
            const isSelf   = m.user_id === currentUserId
            const status   = getMemberStatus(m)
            const avatarBg = m.role === 'organizer' ? 'rgba(196,168,79,0.18)' : m.member_type === 'ghost' ? '#f0f0f0' : 'rgba(74,124,74,0.14)'
            const avatarColor = m.role === 'organizer' ? '#b59a3c' : m.member_type === 'ghost' ? '#9a9a9a' : '#4a7c4a'
            const isEditingHcp = editingHcpId === m.id

            return (
              <div key={m.id} style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--cream-dark)', display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
                {/* Avatar */}
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarBg, color: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-sans)', border: m.role === 'organizer' ? '2px solid rgba(196,168,79,0.4)' : 'none' }}>
                  {getInitials(name)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green-deep)', fontFamily: 'var(--font-sans)' }}>{name}</span>
                    {m.role === 'organizer' && (
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(196,168,79,0.2)', color: '#b59a3c', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
                        Organizer
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, letterSpacing: '0.04em', fontFamily: 'var(--font-sans)', background: status.bg, color: status.color }}>
                      {status.text}
                    </span>
                    {/* HCP inline edit */}
                    {isEditingHcp ? (
                      <input
                        type="number" value={hcpDraft} autoFocus
                        onChange={(e) => setHcpDraft(e.target.value)}
                        onBlur={() => saveHcp(m.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveHcp(m.id); if (e.key === 'Escape') setEditingHcpId(null) }}
                        style={{ width: '64px', padding: '2px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--cream-dark)', fontFamily: 'var(--font-sans)', outline: 'none' }}
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingHcpId(m.id); setHcpDraft(m.handicap != null ? String(m.handicap) : '') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-light)', fontFamily: 'var(--font-sans)', padding: 0 }}
                      >
                        HCP {m.handicap != null ? m.handicap : '—'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Three-dot menu — organizer only, not for self */}
                {isOrganizer && !isSelf && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-light)', lineHeight: 1, padding: '4px 8px' }}
                    >
                      ···
                    </button>
                    {menuOpenId === m.id && (
                      <>
                        <div onClick={() => setMenuOpenId(null)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                        <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.14)', border: '1px solid var(--cream-dark)', zIndex: 51, minWidth: '180px', overflow: 'hidden' }}>
                          {m.email && (
                            <button
                              onClick={() => sendInvite(m)}
                              disabled={invitingId === m.id}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--green-deep)', fontFamily: 'var(--font-sans)' }}
                            >
                              {invitingId === m.id ? 'Sending…' : '✉ Send invite email'}
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(m.id)}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#c0392b', fontFamily: 'var(--font-sans)' }}
                          >
                            Remove from trip
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--cream-dark)', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>👥</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--green-deep)', marginBottom: '6px' }}>Add your crew</div>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>
            Invite golfers below — add them manually or share a link.
          </p>
          <button
            onClick={copyLink}
            style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-dark)', background: copied ? 'rgba(74,124,74,0.1)' : 'var(--cream)', color: copied ? 'var(--green-light)' : 'var(--text-mid)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}
          >
            {copied ? '✓ Invite link copied!' : '🔗 Copy invite link'}
          </button>
        </div>
      )}

      {/* Add member form — organizer only */}
      {isOrganizer && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: '20px 24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '14px', fontFamily: 'var(--font-sans)' }}>
            Add Member
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text" placeholder="Name *" value={addForm.display_name}
              onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              style={inputStyle}
            />
            <input
              type="number" placeholder="HCP" value={addForm.handicap}
              onChange={(e) => setAddForm((f) => ({ ...f, handicap: e.target.value }))}
              style={inputStyle}
            />
            <input
              type="email" placeholder="Email (optional)" value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              style={inputStyle}
            />
          </div>
          {addError && (
            <p style={{ fontSize: '12px', color: '#c0392b', margin: '0 0 8px', fontFamily: 'var(--font-sans)' }}>{addError}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleAdd}
              disabled={addSaving || !addForm.display_name.trim()}
              style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: addSaving || !addForm.display_name.trim() ? 'var(--cream-dark)' : 'var(--green-deep)', color: addSaving || !addForm.display_name.trim() ? 'var(--text-light)' : 'var(--gold-light)', fontSize: '13px', fontWeight: 600, cursor: addSaving || !addForm.display_name.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}
            >
              {addSaving ? 'Adding…' : '+ Add Member'}
            </button>
            {!isEmpty && (
              <button
                onClick={copyLink}
                style={{ background: 'none', border: 'none', fontSize: '13px', color: copied ? 'var(--green-light)' : 'var(--text-light)', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: '10px 0' }}
              >
                {copied ? '✓ Copied!' : '🔗 Copy invite link'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Leave trip */}
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
  tripId, trip, memberCount, currentUserId, isOrganizer, shareToken,
}: {
  tripId:        string
  trip:          Trip
  memberCount:   number
  currentUserId: string | undefined
  isOrganizer:   boolean
  shareToken:    string | null
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
  const [drawerSaving,    setDrawerSaving]    = useState(false)
  const [confirmDelId,    setConfirmDelId]    = useState<string | null>(null)
  const [regenConfirm,    setRegenConfirm]    = useState(false)
  const [genCount,        setGenCount]        = useState(0)
  const [customizeOpen,   setCustomizeOpen]   = useState(false)
  const [shareOpen,       setShareOpen]       = useState(false)
  const [cTagline,        setCTagline]        = useState('')
  const [cDayNotes,       setCDayNotes]       = useState<Record<string, string>>({})
  const [cCoverUrl,       setCCoverUrl]       = useState('')
  const [customizeSaving, setCustomizeSaving] = useState(false)
  const [customizeSaved,  setCustomizeSaved]  = useState(false)
  const [copyLabel,       setCopyLabel]       = useState<string | null>(null)
  const [uploading,       setUploading]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Confirmed booking state
  type BookedTeeTime = {
    id: string; trip_id: string; course_id: string | null; course_name: string;
    tee_date: string; tee_time: string; num_players: number | null;
    confirmation_number: string | null; green_fee_per_player: number | null;
  }
  type BookedAccommodation = {
    id: string; trip_id: string; name: string;
    check_in_date: string; check_out_date: string;
    check_in_time: string | null; check_out_time: string | null;
  }
  const [bookedTeeTimes,     setBookedTeeTimes]     = useState<BookedTeeTime[]>([])
  const [bookedAccommodations, setBookedAccommodations] = useState<BookedAccommodation[]>([])

  const tripDays = getTripDays(trip.start_date, trip.end_date)

  const appUrl     = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl   = shareToken ? `${appUrl}/share/${shareToken}` : null
  const brochureUrl = shareToken ? `${appUrl}/share/${shareToken}/brochure` : null

  useEffect(() => {
    fetchItems()
    fetchTripCourses()
    fetchCustomizations()
    fetchBookedData()
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

  async function fetchBookedData() {
    const [{ data: tt }, { data: acc }] = await Promise.all([
      supabase.from('tee_times').select('id, trip_id, course_id, course_name, tee_date, tee_time, num_players, confirmation_number, green_fee_per_player').eq('trip_id', tripId).order('tee_date').order('tee_time'),
      supabase.from('accommodations').select('id, trip_id, name, check_in_date, check_out_date, check_in_time, check_out_time').eq('trip_id', tripId).order('check_in_date'),
    ])
    setBookedTeeTimes((tt || []) as BookedTeeTime[])
    setBookedAccommodations((acc || []) as BookedAccommodation[])
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

  // ── Booking mismatch helpers ────────────────────────────────────────────
  function dateToDayNum(dateStr: string): number {
    if (!trip.start_date) return -1
    const d = new Date(dateStr + 'T12:00:00')
    const s = new Date(trip.start_date + 'T12:00:00')
    return Math.round((d.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  function fmtTime12(time: string): string {
    const [hStr, mStr] = time.split(':')
    let h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    if (h > 12) h -= 12
    if (h === 0) h = 12
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  function fmtDateShort(dateStr: string): string {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function getMissingTeeTimes(dayNum: number) {
    return bookedTeeTimes.filter((tt) => {
      const ttDay = dateToDayNum(tt.tee_date)
      if (ttDay !== dayNum) return false
      // Check if any itinerary item matches this tee time (same day + course_id + type)
      return !items.some((item) =>
        item.day_number === dayNum &&
        item.type === 'tee_time' &&
        item.course_id === tt.course_id
      )
    })
  }

  function getMissingAccommodations(dayNum: number) {
    return bookedAccommodations.filter((acc) => {
      const checkInDay = dateToDayNum(acc.check_in_date)
      if (checkInDay !== dayNum) return false
      // Check if an accommodation item already exists for this day mentioning this property
      return !items.some((item) =>
        item.day_number === dayNum &&
        item.type === 'accommodation' &&
        item.title.toLowerCase().includes(acc.name.toLowerCase())
      )
    })
  }

  async function addTeeTimeToItinerary(tt: BookedTeeTime) {
    const dayNum = dateToDayNum(tt.tee_date)
    if (dayNum < 1) return
    const payload = {
      trip_id:     tripId,
      day_number:  dayNum,
      start_time:  fmtTime12(tt.tee_time),
      title:       tt.course_name,
      description: null,
      type:        'tee_time' as const,
      course_id:   tt.course_id || null,
      created_by:  currentUserId ?? null,
    }
    const { data } = await supabase.from('itinerary_items').insert(payload).select().single()
    if (data) setItems((prev) => [...prev, data])
  }

  async function addAccommodationToItinerary(acc: BookedAccommodation) {
    const dayNum = dateToDayNum(acc.check_in_date)
    if (dayNum < 1) return
    const checkInTime = acc.check_in_time ? fmtTime12(acc.check_in_time) : '3:00 PM'
    const payload = {
      trip_id:     tripId,
      day_number:  dayNum,
      start_time:  checkInTime,
      title:       `Check in — ${acc.name}`,
      description: null,
      type:        'accommodation' as const,
      course_id:   null,
      created_by:  currentUserId ?? null,
    }
    const { data } = await supabase.from('itinerary_items').insert(payload).select().single()
    if (data) setItems((prev) => [...prev, data])
  }

  async function fetchCustomizations() {
    const { data } = await supabase
      .from('trip_report_customizations')
      .select('tagline, day_notes, cover_photo_url')
      .eq('trip_id', tripId)
      .single()
    if (data) {
      setCTagline(data.tagline ?? '')
      setCDayNotes((data.day_notes as Record<string, string>) ?? {})
      setCCoverUrl(data.cover_photo_url ?? '')
    }
  }

  async function saveCustomizations() {
    setCustomizeSaving(true)
    await supabase.from('trip_report_customizations').upsert({
      trip_id:         tripId,
      tagline:         cTagline.trim() || null,
      day_notes:       cDayNotes,
      cover_photo_url: cCoverUrl || null,
      updated_at:      new Date().toISOString(),
    })
    setCustomizeSaving(false)
    setCustomizeSaved(true)
    setTimeout(() => setCustomizeSaved(false), 2500)
  }

  async function copyLink(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopyLabel(label)
    setTimeout(() => setCopyLabel(null), 2000)
  }

  async function uploadCoverPhoto(file: File) {
    setUploading(true)
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${tripId}/cover.${ext}`
    const { data, error } = await supabase.storage
      .from('trip-photos').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('trip-photos').getPublicUrl(path)
      setCCoverUrl(urlData.publicUrl)
    }
    setUploading(false)
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

              {/* Report buttons — organizer only */}
              {isOrganizer && shareToken && (
                <>
                  <button
                    onClick={() => { setCustomizeOpen(true); setShareOpen(false) }}
                    style={{
                      background: 'transparent', border: '1px solid var(--cream-dark)',
                      borderRadius: 'var(--radius-md)', padding: '9px 16px',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', color: 'var(--text-mid)',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    ✦ Customize Report
                  </button>
                  <button
                    onClick={() => { setShareOpen((p) => !p); setCustomizeOpen(false) }}
                    style={{
                      background: 'var(--green-deep)', border: 'none',
                      borderRadius: 'var(--radius-md)', padding: '9px 16px',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', color: 'var(--gold-light)',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    ↗ Share Report
                  </button>
                </>
              )}
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

                    {/* Booking mismatch banners */}
                    {getMissingTeeTimes(dayNum).map((tt) => (
                      <div key={`miss-tt-${tt.id}`} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: '#FEF9E7', border: '1px solid #F0D567',
                        borderRadius: 'var(--radius-md)', padding: '10px 14px',
                        marginBottom: '8px', fontSize: '13px', color: '#7A6100',
                      }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                        <span style={{ flex: 1 }}>
                          Confirmed tee time not on itinerary — <strong>{fmtTime12(tt.tee_time)} {tt.course_name}</strong>
                        </span>
                        <button
                          onClick={() => addTeeTimeToItinerary(tt)}
                          style={{
                            background: 'none', border: '1px solid #D4A900',
                            borderRadius: '6px', padding: '4px 12px', fontSize: '12px',
                            fontWeight: 600, color: '#7A6100', cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Add to Itinerary
                        </button>
                      </div>
                    ))}
                    {getMissingAccommodations(dayNum).map((acc) => (
                      <div key={`miss-acc-${acc.id}`} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: '#FEF9E7', border: '1px solid #F0D567',
                        borderRadius: 'var(--radius-md)', padding: '10px 14px',
                        marginBottom: '8px', fontSize: '13px', color: '#7A6100',
                      }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                        <span style={{ flex: 1 }}>
                          Accommodation not on itinerary — <strong>{acc.name}</strong> (Check-in {fmtDateShort(acc.check_in_date)})
                        </span>
                        <button
                          onClick={() => addAccommodationToItinerary(acc)}
                          style={{
                            background: 'none', border: '1px solid #D4A900',
                            borderRadius: '6px', padding: '4px 12px', fontSize: '12px',
                            fontWeight: 600, color: '#7A6100', cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Add to Itinerary
                        </button>
                      </div>
                    ))}

                    {/* Items — tee times grouped by course */}
                    {dayItems.length > 0 ? (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px',
                      }}>
                        {groupDayItems(dayItems).map((entry, idx) => {
                          if (entry.kind === 'tee_time_group') {
                            const clr = TYPE_COLORS['tee_time']
                            const linkedCourse = entry.courseId
                              ? tripCourses.find((tc) => tc.course_id === entry.courseId)
                              : undefined
                            const times = entry.items
                              .map(i => i.start_time)
                              .filter(Boolean) as string[]
                            const totalPlayers = entry.items.length * 4 // rough estimate
                            const desc = entry.items.length > 1
                              ? `${entry.items.length} groups · Tee times: ${times.join(', ')}`
                              : entry.items[0]?.description || null

                            return (
                              <div
                                key={entry.items[0].id}
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
                                <div style={{ width: '4px', background: clr, flexShrink: 0 }} />
                                <div style={{
                                  flex: 1, padding: '14px 16px',
                                  display: 'flex', gap: '16px', alignItems: 'flex-start',
                                }}>
                                  {entry.firstTime ? (
                                    <div style={{
                                      width: '68px', flexShrink: 0, fontSize: '11px',
                                      color: 'var(--text-light)', fontFamily: 'var(--font-sans)',
                                      fontWeight: 600, letterSpacing: '0.05em',
                                      textTransform: 'uppercase', paddingTop: '2px',
                                    }}>
                                      {entry.firstTime}
                                    </div>
                                  ) : (
                                    <div style={{
                                      width: '68px', flexShrink: 0, fontSize: '9px',
                                      color: 'var(--cream-dark)', fontFamily: 'var(--font-sans)',
                                      fontWeight: 400, paddingTop: '4px', fontStyle: 'italic',
                                    }}>
                                      No time
                                    </div>
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      display: 'flex', alignItems: 'center',
                                      gap: '10px', flexWrap: 'wrap',
                                      marginBottom: desc ? '4px' : 0,
                                    }}>
                                      <span style={{
                                        fontSize: '14px', fontWeight: 500,
                                        color: 'var(--green-deep)', fontFamily: 'var(--font-sans)',
                                      }}>
                                        {entry.courseName}
                                      </span>
                                      <span style={{
                                        fontSize: '9px', padding: '2px 8px',
                                        borderRadius: '20px', fontWeight: 700,
                                        letterSpacing: '0.1em', fontFamily: 'var(--font-sans)',
                                        background: `${clr}18`, color: clr,
                                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                                      }}>
                                        {TYPE_LABELS['tee_time']}
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
                                    {desc && (
                                      <p style={{
                                        fontSize: '13px', color: 'var(--text-light)',
                                        fontWeight: 300, lineHeight: 1.6, margin: 0,
                                        fontFamily: 'var(--font-sans)',
                                      }}>
                                        {desc}
                                      </p>
                                    )}
                                  </div>
                                  {/* Actions — edit/delete for first item in group */}
                                  <div style={{
                                    display: 'flex', alignItems: 'center',
                                    gap: '4px', flexShrink: 0,
                                  }}>
                                    <button
                                      onClick={() => openDrawerForEdit(entry.items[0])}
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
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          // Single (non-tee-time) item — original rendering
                          const item = entry.item
                          const clr = TYPE_COLORS[item.type]
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
                              <div style={{ width: '4px', background: clr, flexShrink: 0 }} />
                              <div style={{
                                flex: 1, padding: '14px 16px',
                                display: 'flex', gap: '16px', alignItems: 'flex-start',
                              }}>
                                {item.start_time ? (
                                  <div style={{
                                    width: '68px', flexShrink: 0, fontSize: '11px',
                                    color: 'var(--text-light)', fontFamily: 'var(--font-sans)',
                                    fontWeight: 600, letterSpacing: '0.05em',
                                    textTransform: 'uppercase', paddingTop: '2px',
                                  }}>
                                    {item.start_time}
                                  </div>
                                ) : (
                                  <div style={{
                                    width: '68px', flexShrink: 0, fontSize: '9px',
                                    color: 'var(--cream-dark)', fontFamily: 'var(--font-sans)',
                                    fontWeight: 400, paddingTop: '4px', fontStyle: 'italic',
                                  }}>
                                    No time
                                  </div>
                                )}
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

      {/* ── Share popover backdrop ── */}
      {shareOpen && (
        <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
      )}

      {/* ── Share popover ── */}
      {shareOpen && shareUrl && (
        <div style={{
          position: 'fixed', top: '80px', right: '48px',
          background: 'var(--white)', border: '1px solid var(--cream-dark)',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          padding: '20px', width: '320px', zIndex: 60,
          animation: 'itin-fadeUp 0.15s ease',
        }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--green-deep)', fontWeight: 600, marginBottom: '16px' }}>
            Share Trip Report
          </div>
          {[
            { label: 'Quick View', url: shareUrl,    key: 'quick' },
            { label: 'Brochure',   url: brochureUrl!, key: 'brochure' },
          ].map(({ label, url, key }) => (
            <div key={key} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-light)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  readOnly value={url}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--cream-dark)', background: 'var(--cream)',
                    fontSize: '12px', color: 'var(--text-mid)', fontFamily: 'var(--font-sans)',
                    outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                />
                <button
                  onClick={() => copyLink(url, key)}
                  style={{
                    padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                    background: copyLabel === key ? 'var(--green-light)' : 'var(--green-deep)',
                    color: 'var(--gold-light)', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0,
                  }}
                >
                  {copyLabel === key ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--cream-dark)', paddingTop: '12px' }}>
            <button
              onClick={() => { setShareOpen(false); window.print() }}
              style={{
                width: '100%', padding: '10px', borderRadius: 'var(--radius-md)',
                background: 'var(--cream)', border: '1px solid var(--cream-dark)',
                color: 'var(--text-mid)', fontSize: '12px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              ⎙ Download PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Customize drawer backdrop ── */}
      {customizeOpen && (
        <div onClick={() => setCustomizeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      )}

      {/* ── Customize Report drawer ── */}
      {customizeOpen && (
        <>
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px',
            background: 'var(--white)', zIndex: 51, display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
            animation: 'itin-slideIn 0.22s ease',
          }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--green-deep)', fontWeight: 600 }}>Customize Report</div>
              <button onClick={() => setCustomizeOpen(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

              {/* Tagline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={itinLabelStyle}>Trip Tagline</label>
                <input
                  type="text" value={cTagline} maxLength={100}
                  onChange={(e) => setCTagline(e.target.value)}
                  placeholder="Five guys. Four courses. One unforgettable week."
                  style={itinInputStyle}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textAlign: 'right' }}>{cTagline.length}/100</div>
              </div>

              {/* Day notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={itinLabelStyle}>Day Notes</div>
                {tripDays.map(({ dayNum }) => (
                  <div key={dayNum} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>Day {dayNum}</label>
                    <textarea
                      rows={2}
                      value={cDayNotes[String(dayNum)] ?? ''}
                      onChange={(e) => setCDayNotes((prev) => ({ ...prev, [String(dayNum)]: e.target.value }))}
                      placeholder={`Add a note for the group about Day ${dayNum}…`}
                      style={{ ...itinInputStyle, resize: 'vertical' }}
                    />
                  </div>
                ))}
              </div>

              {/* Group photo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={itinLabelStyle}>Group Photo</div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300, margin: 0 }}>Shown as a circular inset on the brochure cover.</p>
                {cCoverUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={cCoverUrl} alt="Cover" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
                    <button onClick={() => setCCoverUrl('')} style={{ fontSize: '11px', color: '#c0392b', background: 'transparent', border: '1px solid rgba(192,57,43,0.3)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Remove</button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      border: '2px dashed var(--cream-dark)', borderRadius: '10px',
                      padding: '18px', background: 'var(--cream)', cursor: uploading ? 'wait' : 'pointer',
                      color: 'var(--text-light)', fontSize: '13px', fontFamily: 'var(--font-sans)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>📷</span>
                    {uploading ? 'Uploading…' : '+ Add group photo'}
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCoverPhoto(f) }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid var(--cream-dark)', flexShrink: 0 }}>
              <button
                onClick={saveCustomizations}
                disabled={customizeSaving}
                style={{
                  width: '100%', padding: '13px', borderRadius: 'var(--radius-md)', border: 'none',
                  background: customizeSaved ? 'var(--green-light)' : 'var(--green-deep)',
                  color: 'var(--gold-light)', fontSize: '14px', fontWeight: 600,
                  cursor: customizeSaving ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.05em', transition: 'all 0.2s',
                }}
              >
                {customizeSaving ? 'Saving…' : customizeSaved ? '✓ Saved!' : 'Save Changes'}
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

// ─── Section: Trip Courses ───────────────────────────────────────────────────

type TripCourseDetail = {
  id: string
  trip_id: string
  course_id: string | null
  course_name: string | null
  course_location: string | null
  courses: {
    slug: string
    google_place_id: string | null
  } | null
}

function TripCoursesSection({ tripId }: { tripId: string }) {
  const { session } = useAuth()
  const [courses, setCourses] = useState<TripCourseDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('trip_courses')
      .select('id, trip_id, course_id, course_name, course_location, courses(slug, google_place_id)')
      .eq('trip_id', tripId)
      .then(({ data }) => {
        // Supabase join returns courses as array; flatten to single object
        const mapped = (data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          courses: Array.isArray(row.courses) ? row.courses[0] ?? null : row.courses ?? null,
        })) as TripCourseDetail[]
        setCourses(mapped)
        setLoading(false)
      })
  }, [tripId])

  async function handleRemove(courseId: string) {
    setRemoving(courseId)
    const { data: { session: s } } = await supabase.auth.getSession()
    await fetch(`/api/trips/${tripId}/courses`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token ?? ''}` },
      body: JSON.stringify({ courseId }),
    })
    setCourses((prev) => prev.filter((c) => c.course_id !== courseId))
    setRemoving(null)
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--text-light)' }}>Loading courses…</div>
  }

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--green-deep)', fontWeight: 700, margin: '0 0 4px' }}>
            Trip Courses
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, margin: 0, fontFamily: 'var(--font-sans)' }}>
            {courses.length} course{courses.length !== 1 ? 's' : ''} added
          </p>
        </div>
        <a
          href={`/courses?tripId=${tripId}`}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            background: 'var(--gold)', color: 'var(--green-deep)',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none', fontFamily: 'var(--font-sans)',
          }}
        >
          + Add Course
        </a>
      </div>

      {courses.length === 0 ? (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--cream-dark)', padding: '48px 36px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⛳</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--green-deep)', marginBottom: '8px' }}>No courses added yet</div>
          <p style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 300, margin: '0 0 20px', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
            Browse the directory or ask the Golf Concierge for recommendations.
          </p>
          <a
            href={`/courses?tripId=${tripId}`}
            style={{
              display: 'inline-block', padding: '10px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--gold)', color: 'var(--green-deep)',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              textDecoration: 'none', fontFamily: 'var(--font-sans)',
            }}
          >
            Browse Course Directory →
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {courses.map((c) => (
            <TripCourseCard
              key={c.id}
              course={c}
              onRemove={() => c.course_id && handleRemove(c.course_id)}
              removing={removing === c.course_id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TripCourseCard({ course, onRemove, removing }: {
  course: TripCourseDetail; onRemove: () => void; removing: boolean
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const placeId = course.courses?.google_place_id

  useEffect(() => {
    if (!placeId) return
    fetch(`/api/course-photos/${placeId}`)
      .then((r) => r.json())
      .then((d) => { if (d.photos?.[0]) setPhotoUrl(d.photos[0]) })
      .catch(() => {})
  }, [placeId])

  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-lg)',
      display: 'flex', overflow: 'hidden', alignItems: 'center',
    }}>
      {/* Photo */}
      <div style={{
        width: '100px', minHeight: '80px', flexShrink: 0,
        background: photoUrl ? `url(${photoUrl}) center/cover` : 'linear-gradient(135deg, var(--green-mid), var(--green-light))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!photoUrl && <span style={{ fontSize: '24px' }}>⛳</span>}
      </div>

      {/* Info */}
      <div style={{ flex: 1, padding: '14px 18px', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--green-deep)', marginBottom: '3px' }}>
          {course.course_name ?? 'Unknown Course'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 300 }}>
          📍 {course.course_location ?? 'Unknown location'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', padding: '14px 16px', flexShrink: 0, alignItems: 'center' }}>
        {course.courses?.slug && (
          <a
            href={`/course/${course.courses.slug}`}
            style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--gold)', textDecoration: 'none',
              letterSpacing: '0.03em', whiteSpace: 'nowrap',
            }}
          >
            View Course →
          </a>
        )}
        <button
          onClick={onRemove}
          disabled={removing}
          style={{
            background: 'transparent', border: '1px solid rgba(192,57,43,0.3)',
            borderRadius: 'var(--radius-sm)', padding: '5px 10px',
            fontSize: '11px', color: '#c0392b', cursor: removing ? 'default' : 'pointer',
            fontFamily: 'var(--font-sans)', fontWeight: 500, opacity: removing ? 0.5 : 1,
          }}
        >
          {removing ? '…' : 'Remove'}
        </button>
      </div>
    </div>
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
  const searchParams = useSearchParams()

  const VALID_TABS = ['concierge', 'itinerary', 'group', 'tripcourses', 'decisions']
  const initialTab = searchParams.get('tab')
  const defaultNav = initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'concierge'

  const [trip,      setTrip]      = useState<Trip | null>(null)
  const [members,   setMembers]   = useState<TripMember[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [copied,    setCopied]    = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [activeNav, setActiveNav] = useState(defaultNav)

  const isOrganizer = trip?.created_by === session?.user.id

  useEffect(() => {
    async function fetchTrip() {
      const { data, error } = await supabase.from('trips').select('*').eq('id', id).single()
      if (error) { setError('Trip not found.'); setLoading(false); return }
      setTrip(data)

      // Try new columns (post-migration); fall back to basic select if columns don't exist yet
      const { data: newRows, error: newColErr } = await supabase
        .from('trip_members')
        .select('id, user_id, display_name, email, handicap, role, member_type, invite_status, status, invite_token')
        .eq('trip_id', id)
        .order('created_at', { ascending: true })

      const rawRows = newColErr
        ? ((await supabase.from('trip_members').select('id, user_id, status').eq('trip_id', id)).data ?? []).map((m: Record<string, unknown>) => ({
            ...m, display_name: null, email: null, handicap: null,
            role: 'member', member_type: 'registered', invite_status: 'accepted', invite_token: null,
          }))
        : (newRows ?? [])

      if (rawRows.length > 0) {
        const userIds = rawRows.map((m: Record<string, unknown>) => m.user_id).filter(Boolean) as string[]
        const userMap: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {}
        if (userIds.length > 0) {
          const { data: userData } = await supabase
            .from('users').select('id, full_name, email, avatar_url').in('id', userIds)
          userData?.forEach((u) => { userMap[u.id] = u })
        }
        setMembers(rawRows.map((m: Record<string, unknown>) => ({
          ...m, users: m.user_id ? (userMap[m.user_id as string] ?? null) : null,
        })) as TripMember[])
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

  async function handleRemoveMember(memberId: number) {
    await supabase.from('trip_members').delete().eq('id', memberId)
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  async function handleLeaveTrip() {
    if (!session) return
    await supabase.from('trip_members').delete().eq('trip_id', id).eq('user_id', session.user.id)
    router.push('/dashboard')
  }

  const sidebarMembers = members.map((m, i) => ({
    initials: getInitials(m.users?.full_name ?? m.display_name ?? m.users?.email ?? m.email ?? '?'),
    color:    m.role === 'organizer' ? '#c4a84f' : AVATAR_COLORS[i % AVATAR_COLORS.length],
  }))

  const isConcierge   = activeNav === 'concierge'
  const isItinerary   = activeNav === 'itinerary'
  const isTripCourses = activeNav === 'tripcourses'
  const isFullHeight  = isConcierge || isItinerary

  // Compute handicap range string for concierge context
  const hcps = members.map((m) => m.handicap).filter((h): h is number => h != null)
  const handicapRange = hcps.length > 0
    ? hcps.length === 1 ? `${hcps[0]}` : `${Math.min(...hcps)}–${Math.max(...hcps)}`
    : null

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)', background: 'var(--cream)' }}>

        {/* Sidebar */}
        {trip && (
          <Sidebar
            navItems={buildNavItems(members.length)}
            activeId={activeNav}
            onItemClick={(navId) => {
                if (navId === 'report')    { window.open(`/trip/${id}/report?pdf=true`, '_blank');  return }
                if (navId === 'games')    { router.push(`/trip/${id}/games`);          return }
                if (navId === 'teetimes') { router.push(`/trip/${id}/tee-times`);      return }
                if (navId === 'hotels')   { router.push(`/trip/${id}/accommodations`); return }
                if (navId === 'budget')   { router.push(`/trip/${id}/budget`);         return }
                setEditing(false); setActiveNav(navId)
              }}
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

          {trip && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {isOrganizer && (
                    <button
                      onClick={() => setEditing(true)}
                      style={{
                        padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--cream-dark)', background: 'var(--white)',
                        fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--green-deep)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      Edit Trip
                    </button>
                  )}
                  <Link href="/dashboard" style={{ fontSize: '12px', color: 'var(--text-light)', textDecoration: 'none', fontWeight: 400 }}>
                    ← Dashboard
                  </Link>
                </div>
              </div>

              {/* Section routing */}
              {isConcierge ? (
                <TripConciergeSection
                  tripId={trip.id}
                  tripName={trip.name}
                  memberCount={members.length}
                  handicapRange={handicapRange}
                  startDate={trip.start_date}
                  endDate={trip.end_date}
                />
              ) : isItinerary ? (
                <TripItinerarySection
                  tripId={trip.id}
                  trip={trip}
                  memberCount={members.length}
                  currentUserId={session?.user.id}
                  isOrganizer={isOrganizer}
                  shareToken={trip.share_token}
                />
              ) : (
                <div style={{ padding: '36px 48px' }}>
                  {activeNav === 'group' ? (
                    <GroupSection
                      tripId={trip.id}
                      trip={trip}
                      members={members}
                      isOrganizer={isOrganizer}
                      onEdit={() => setEditing(true)}
                      onCopyLink={copyInviteLink}
                      onLeaveTrip={handleLeaveTrip}
                      onMembersChange={setMembers}
                      currentUserId={session?.user.id}
                    />
                  ) : isTripCourses ? (
                    <TripCoursesSection tripId={trip.id} />
                  ) : activeNav === 'decisions' ? (
                    <GroupDecisionsSection
                      tripId={trip.id}
                      members={members}
                      isOrganizer={isOrganizer}
                      currentUserId={session?.user.id}
                    />
                  ) : (
                    <ComingSoon label={SECTION_LABELS[activeNav]} />
                  )}
                </div>
              )}
            </>
          )}

          {/* Edit Trip modal */}
          {trip && editing && (
            <EditTripForm
              trip={trip}
              onSave={(updated) => { setTrip({ ...trip, ...updated }); setEditing(false) }}
              onCancel={() => setEditing(false)}
            />
          )}

        </div>
      </div>
    </ProtectedRoute>
  )
}
