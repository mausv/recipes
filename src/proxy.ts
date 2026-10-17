import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  const login = new URL('/login', request.url)
  const { pathname, search } = request.nextUrl
  if (pathname !== '/') login.searchParams.set('next', pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!api|login|signup|\\.well-known|_next|favicon.ico|manifest.webmanifest).*)'],
}
