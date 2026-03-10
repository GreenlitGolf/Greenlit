'use client'

import { useState, useRef, useEffect } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import CourseCard, { type CoursePickData } from '@/components/concierge/CourseCard'
import ProtectedRoute from '@/components/ProtectedRoute'

const NAV_ITEMS = [
  { id: 'concierge', icon: '✦', label: 'Golf Concierge', href: '/discover' },
  { id: 'dashboard',  icon: '📋', label: 'My Trips',       href: '/dashboard' },
  { id: 'new-trip',   icon: '➕', label: 'New Trip',       href: '/trips/new' },
]

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  coursePicks?: CoursePickData[]
}

const WELCOME: ChatMessage = {
  id:      'welcome',
  role:    'assistant',
  content: "Welcome to Greenlit. I'm your golf concierge — here to help your crew stop texting and start playing. Tell me about the trip you have in mind: destination dreams, when you're thinking of going, how many are in the group, and what kind of experience you're after. Bucket-list links or hidden-gem track?",
}

// Strip GREENLIT_PICKS block from visible text and parse courses
function parseResponse(raw: string): { text: string; courses: CoursePickData[] } {
  const picksMatch = raw.match(/GREENLIT_PICKS:\s*([\s\S]*?)\s*END_PICKS/)
  let courses: CoursePickData[] = []

  if (picksMatch) {
    try {
      courses = JSON.parse(picksMatch[1].trim())
    } catch {
      courses = []
    }
  }

  const text = raw
    .replace(/GREENLIT_PICKS:[\s\S]*?END_PICKS/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, courses }
}

export default function DiscoverPage() {
  const [messages,    setMessages]    = useState<ChatMessage[]>([WELCOME])
  const [input,       setInput]       = useState('')
  const [streaming,   setStreaming]   = useState(false)
  const [addedNotice, setAddedNotice] = useState<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ])

    try {
      const res = await fetch('/api/concierge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   raw     = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value, { stream: true })

        // While streaming: show raw text but hide the picks block
        const displayText = raw
          .replace(/GREENLIT_PICKS:[\s\S]*?(END_PICKS|$)/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: displayText } : m
          )
        )
      }

      // On completion: parse courses
      const { text: finalText, courses } = parseResponse(raw)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: finalText, coursePicks: courses.length ? courses : undefined }
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
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleAddToTrip(course: CoursePickData) {
    setAddedNotice(`"${course.name}" saved — create a trip to attach it.`)
    setTimeout(() => setAddedNotice(null), 4000)
  }

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--cream)', fontFamily: 'var(--font-sans)' }}>
        <Sidebar
          navItems={NAV_ITEMS}
          activeId="concierge"
          tripName="Golf Concierge"
          tripMeta="AI-Powered Planning"
        />

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Page header */}
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
            <div>
              <div
                style={{
                  fontSize:      '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color:         'var(--green-light)',
                  fontWeight:    600,
                  marginBottom:  '2px',
                }}
              >
                AI Concierge
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize:   '18px',
                  color:      'var(--green-deep)',
                  fontWeight: 600,
                }}
              >
                Golf Concierge
              </div>
            </div>

            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '8px',
                fontSize:   '12px',
                color:      'var(--green-muted)',
              }}
            >
              <span
                style={{
                  width:        '7px',
                  height:       '7px',
                  borderRadius: '50%',
                  background:   streaming ? 'var(--gold)' : 'var(--green-light)',
                  display:      'inline-block',
                  transition:   'background 0.3s',
                }}
              />
              {streaming ? 'Thinking…' : 'Online'}
            </div>
          </div>

          {/* Added notice banner */}
          {addedNotice && (
            <div
              style={{
                background:    'var(--green-mid)',
                color:         'var(--gold-light)',
                padding:       '10px 40px',
                fontSize:      '13px',
                fontWeight:    400,
                display:       'flex',
                alignItems:    'center',
                justifyContent:'space-between',
                flexShrink:    0,
              }}
            >
              <span>{addedNotice}</span>
              <a href="/trips/new" style={{ color: 'var(--gold-light)', fontSize: '12px', fontWeight: 600 }}>
                Create a trip →
              </a>
            </div>
          )}

          {/* Messages */}
          <div
            style={{
              flex:      1,
              overflowY: 'auto',
              padding:   '32px 40px',
              display:   'flex',
              flexDirection: 'column',
              gap:       '24px',
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
                ) : (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', maxWidth: '80%' }}>
                    {/* Avatar */}
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
                      {/* Text */}
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
                          {streaming && msg.id === messages[messages.length - 1]?.id && (
                            <span
                              style={{
                                display:      'inline-block',
                                width:        '2px',
                                height:       '14px',
                                background:   'var(--green-light)',
                                marginLeft:   '2px',
                                verticalAlign: 'middle',
                                animation:    'blink 1s step-end infinite',
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* Course picks */}
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
                            <CourseCard key={i} course={course} onAddToTrip={handleAddToTrip} />
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

          {/* Input area */}
          <div
            style={{
              background:   'var(--white)',
              borderTop:    '1px solid var(--cream-dark)',
              padding:      '20px 40px',
              flexShrink:   0,
            }}
          >
            <div
              style={{
                display:      'flex',
                gap:          '12px',
                alignItems:   'flex-end',
                background:   'var(--cream)',
                border:       '1px solid var(--cream-dark)',
                borderRadius: 'var(--radius-lg)',
                padding:      '12px 16px',
                transition:   'border-color 0.2s',
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Tell me about your dream golf trip…"
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
                disabled={!input.trim() || streaming}
                style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '50%',
                  background:     !input.trim() || streaming ? 'var(--cream-dark)' : 'var(--green-deep)',
                  border:         'none',
                  cursor:         !input.trim() || streaming ? 'default' : 'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  transition:     'background 0.2s',
                  color:          !input.trim() || streaming ? 'var(--text-light)' : 'var(--gold-light)',
                  fontSize:       '16px',
                }}
              >
                ↑
              </button>
            </div>
            <p
              style={{
                fontSize:   '11px',
                color:      'var(--text-light)',
                textAlign:  'center',
                marginTop:  '10px',
                fontWeight: 300,
              }}
            >
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </ProtectedRoute>
  )
}
