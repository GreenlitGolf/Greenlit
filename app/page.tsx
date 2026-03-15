import type { Metadata } from 'next'
import LandingPageClient from './LandingPageClient'

export const metadata: Metadata = {
  title: 'Greenlit — Golf Trip Planner for Groups',
  description:
    'Plan unforgettable group golf trips with AI-powered course discovery, shared itineraries, tee time tracking, and a beautiful brochure your crew will love.',
  openGraph: {
    title: 'Greenlit — Golf Trip Planner for Groups',
    description: 'Plan unforgettable group golf trips.',
    url: 'https://greenlit.golf',
    siteName: 'Greenlit',
    type: 'website',
  },
}

export default function HomePage() {
  return <LandingPageClient />
}
