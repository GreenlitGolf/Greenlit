'use client'

import { useState, useRef, useEffect } from 'react'
import Link                            from 'next/link'
import CourseCard, { type CoursePickData } from '@/components/concierge/CourseCard'
import { type MatchedCourse }              from '@/app/api/concierge/route'

interface ChatMessage {
  id:          string
  role:        'user' | 'assistant' | 'gate'
  content:     string
  coursePicks?: CoursePickData[]
}

const WELCOME: ChatMessage = {
  id:      'welcome',
  role:    'assistant',
  content: "Welcome to Greenlit. I'm your golf concierge — ask me about any course, destination, or trip you're planning. Where are you thinking of going?",
}

function matchedCourseToPick(c: MatchedCourse): CoursePickData {
  return {
    name:          c.name,
    location:      c.location,
    price:         c.price_min && c.price_max ? `$${c.price_min}–$${c.price_max}` : c.price_min ? `from $${c.price_min}` : '',
    emoji:         c.emoji || '⛳',
    tags:          c.tags ?? [],
    courseId:      c.slug,
    courseUUID:    c.id,
    googlePlaceId: c.google_place_id ?? undefined,
  }
}

function GateCard() {
  return (
    <div
      style={{
        background:    'linear-gradient(135deg, var(--green-deep), var(--green-mid))',
        border:        '1px solid var(--green-mid)',
        borderRadius:  'var(--radius-lg)',
        padding:       '28px 32px',
        display:       'flex',
        flexDirection: 'column',
        gap:           '16px',
        maxWidth:      '420px',
        boxShadow:     '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <div>
        <div
          style={{
            fontSize:      '9px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color:         'var(--gold)',
            fontWeight:    600,
            marginBottom:  '8px',
          }}
        >
          Greenlit
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize:   '20px',
            color:      'var(--cream)',
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          Unlock unlimited concierge access
        </div>
        <div
          style={{
            fontSize:   '13px',
            color:      'rgba(255,255,255,0.65)',
            marginTop:  '8px',
            lineHeight: 1.6,
            fontWeight: 300,
          }}
        >
          Create a free account to keep planning — plus get trip organizing tools, course tracking, and your own itinerary builder.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Link
          href="/signup"
          style={{
            display:        'block',
            textAlign:      'center',
            padding:        '12px 24px',
            background:     'var(--gold)',
            color:          'var(--green-deep)',
            borderRadius:   'var(--radius-sm)',
            fontSize:       '12px',
            fontWeight:     700,
            letterSpacing:  '0.08em',
            textTransform:  'uppercase',
            textDecoration: 'none',
            fontFamily:     'var(--font-sans)',
            transition:     'opacity 0.15s',
          }}
        >
          Create Free Account
        </Link>
        <Link
          href="/login"
          style={{
            display:        'block',
            textAlign:      'center',
            padding:        '10px 24px',
            background:     'transparent',
            color:          'rgba(255,255,255,0.6)',
            borderRadius:   'var(--radius-sm)',
            border:         '1px solid rgba(255,255,255,0.2)',
            fontSize:       '12px',
            fontWeight:     500,
            letterSpacing:  '0.04em',
            textDecoration: 'none',
            fontFamily:     'var(--font-sans)',
          }}
        >
          Already have an account? Log in
        </Link>
      </div>
    </div>
  )
}

export default function ConciergePage() {
  const [messages,  setMessages]  = useState<ChatMessage[]>([WELCOME])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [gated,     setGated]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading || gated) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }

    const history = [
      ...messages.filter((m) => m.id !== 'welcome' && m.role !== 'gate'),
      userMsg,
    ].map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/concierge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history, isGuest: true }),
      })

      if (!res.ok) throw new Error('Request failed')

      const data = await res.json()

      if (data.gated) {
        // Remove the empty placeholder, add gate card
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== assistantId)
            .concat({ id: 'gate', role: 'gate', content: '' })
        )
        setGated(true)
        return
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:     data.message ?? 'Sorry, something went wrong.',
                coursePicks: data.courses?.length
                  ? data.courses.map(matchedCourseToPick)
                  : undefined,
              }
            : m
        )
      )
    } catch (err) {
      console.error(err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      )
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      style={{
        minHeight:   '100vh',
        background:  'var(--cream)',
        fontFamily:  'var(--font-sans)',
        display:     'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          background:     'var(--white)',
          borderBottom:   '1px solid var(--cream-dark)',
          padding:        '0 40px',
          height:         '64px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexShrink:     0,
          position:       'sticky',
          top:            0,
          zIndex:         10,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily:     'var(--font-serif)',
            fontSize:       '18px',
            color:          'var(--green-deep)',
            fontWeight:     600,
            textDecoration: 'none',
          }}
        >
          Greenlit
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--green-muted)' }}>
            <span
              style={{
                width:        '7px',
                height:       '7px',
                borderRadius: '50%',
                background:   loading ? 'var(--gold)' : 'var(--green-light)',
                display:      'inline-block',
                transition:   'background 0.3s',
              }}
            />
            {loading ? 'Thinking…' : 'Online'}
          </div>
          <Link
            href="/login"
            style={{
              padding:        '7px 16px',
              borderRadius:   'var(--radius-sm)',
              border:         '1px solid var(--cream-dark)',
              color:          'var(--green-mid)',
              fontSize:       '12px',
              fontWeight:     500,
              textDecoration: 'none',
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            style={{
              padding:        '7px 16px',
              borderRadius:   'var(--radius-sm)',
              background:     'var(--green-deep)',
              color:          'var(--gold-light)',
              fontSize:       '12px',
              fontWeight:     600,
              textDecoration: 'none',
            }}
          >
            Sign up free
          </Link>
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex:          1,
          maxWidth:      '800px',
          width:         '100%',
          margin:        '0 auto',
          padding:       '40px 24px 160px',
          display:       'flex',
          flexDirection: 'column',
          gap:           '24px',
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    background:   'var(--green-deep)',
                    color:        'var(--cream)',
                    padding:      '12px 18px',
                    borderRadius: '16px 16px 4px 16px',
                    maxWidth:     '72%',
                    fontSize:     '14px',
                    lineHeight:   1.6,
                    fontWeight:   300,
                    whiteSpace:   'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ) : msg.role === 'gate' ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width:          '32px',
                    height:         '32px',
                    borderRadius:   '50%',
                    background:     'linear-gradient(135deg, var(--green-mid), var(--green-light))',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       '14px',
                    flexShrink:     0,
                    marginTop:      '2px',
                  }}
                >
                  ✦
                </div>
                <GateCard />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', maxWidth: '80%' }}>
                <div
                  style={{
                    width:          '32px',
                    height:         '32px',
                    borderRadius:   '50%',
                    background:     'linear-gradient(135deg, var(--green-mid), var(--green-light))',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       '14px',
                    flexShrink:     0,
                    marginTop:      '2px',
                  }}
                >
                  ✦
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {msg.content && (
                    <div
                      style={{
                        background:   'var(--white)',
                        border:       '1px solid var(--cream-dark)',
                        color:        'var(--text-dark)',
                        padding:      '12px 18px',
                        borderRadius: '4px 16px 16px 16px',
                        fontSize:     '14px',
                        lineHeight:   1.7,
                        fontWeight:   300,
                        whiteSpace:   'pre-wrap',
                        boxShadow:    'var(--shadow-subtle)',
                      }}
                    >
                      {msg.content}
                      {loading && msg.id === messages[messages.length - 1]?.id && (
                        <span
                          style={{
                            display:       'inline-block',
                            width:         '2px',
                            height:        '14px',
                            background:    'var(--green-light)',
                            marginLeft:    '2px',
                            verticalAlign: 'middle',
                            animation:     'blink 1s step-end infinite',
                          }}
                        />
                      )}
                    </div>
                  )}

                  {msg.coursePicks && msg.coursePicks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div
                        style={{
                          fontSize:      '9px',
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          color:         'var(--green-muted)',
                          fontWeight:    600,
                          paddingLeft:   '2px',
                        }}
                      >
                        Greenlit Picks
                      </div>
                      {msg.coursePicks.map((course, i) => (
                        <CourseCard key={i} course={course} />
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

      {/* Input — fixed at bottom */}
      <div
        style={{
          position:   'fixed',
          bottom:     0,
          left:       0,
          right:      0,
          background: 'var(--white)',
          borderTop:  '1px solid var(--cream-dark)',
          padding:    '16px 24px',
          zIndex:     20,
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {gated ? (
            <div
              style={{
                textAlign:  'center',
                fontSize:   '13px',
                color:      'var(--text-light)',
                padding:    '12px',
                fontWeight: 300,
              }}
            >
              <Link href="/signup" style={{ color: 'var(--green-mid)', fontWeight: 600, textDecoration: 'none' }}>
                Create a free account
              </Link>{' '}
              to keep the conversation going.
            </div>
          ) : (
            <>
              <div
                style={{
                  display:      'flex',
                  gap:          '12px',
                  alignItems:   'flex-end',
                  background:   'var(--cream)',
                  border:       '1px solid var(--cream-dark)',
                  borderRadius: 'var(--radius-lg)',
                  padding:      '12px 16px',
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about courses, destinations, trip ideas…"
                  rows={1}
                  style={{
                    flex:       1,
                    border:     'none',
                    background: 'transparent',
                    resize:     'none',
                    outline:    'none',
                    fontSize:   '14px',
                    lineHeight: 1.6,
                    color:      'var(--text-dark)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 300,
                    maxHeight:  '120px',
                    overflowY:  'auto',
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  style={{
                    width:          '36px',
                    height:         '36px',
                    borderRadius:   '50%',
                    background:     !input.trim() || loading ? 'var(--cream-dark)' : 'var(--green-deep)',
                    border:         'none',
                    cursor:         !input.trim() || loading ? 'default' : 'pointer',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                    transition:     'background 0.2s',
                    color:          !input.trim() || loading ? 'var(--text-light)' : 'var(--gold-light)',
                    fontSize:       '16px',
                  }}
                >
                  ↑
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-light)', textAlign: 'center', marginTop: '8px', fontWeight: 300 }}>
                {4 - (messages.filter(m => m.role === 'user').length)} free questions remaining · <Link href="/signup" style={{ color: 'var(--green-muted)', textDecoration: 'none' }}>Sign up for unlimited</Link>
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
