'use client'

import { useState } from 'react'

type Props = {
  tripId: string
}

export default function InviteForm({ tripId }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, email }),
    })

    const data = await res.json()

    if (!res.ok) {
      setErrorMsg(data.error ?? 'Failed to send invite')
      setStatus('error')
    } else {
      setStatus('sent')
      setEmail('')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Invite by email</p>
      <form onSubmit={handleInvite} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-600"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending...' : 'Send'}
        </button>
      </form>
      {status === 'sent' && (
        <p className="text-sm text-green-700">Invite sent!</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}
    </div>
  )
}
