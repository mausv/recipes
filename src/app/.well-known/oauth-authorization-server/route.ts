import { auth } from '@/lib/auth'

export function GET(request: Request) {
  return auth.handler(request)
}
