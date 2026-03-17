import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join the Waitlist — Greenlit Golf Trip Planner',
  description:
    'The golf trip planning tool your group actually needs. Join the waitlist for early access.',
  openGraph: {
    title: 'Golf trips, finally sorted.',
    description:
      'Join the Greenlit waitlist for early access to the golf trip planner your group actually needs.',
    url: 'https://greenlit.golf/waitlist',
    images: [{ url: 'https://greenlit.golf/og-waitlist.jpg' }],
  },
}

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
