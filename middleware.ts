import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const IS_LIVE = process.env.NEXT_PUBLIC_IS_LIVE === 'true'

export function middleware(request: NextRequest) {
  if (!IS_LIVE && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/waitlist', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
