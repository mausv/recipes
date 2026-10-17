import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!api|login|signup|\\.well-known|_next|favicon.ico|manifest.webmanifest).*)'],
}
