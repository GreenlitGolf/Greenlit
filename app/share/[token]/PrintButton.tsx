'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: '7px 14px', fontSize: '12px', fontWeight: 500,
        border: '1px solid var(--cream-dark)', borderRadius: '8px',
        background: 'transparent', color: 'var(--text-mid)',
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}
    >
      ⎙ Print
    </button>
  )
}
