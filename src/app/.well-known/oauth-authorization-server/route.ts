import { connection } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  await connection()
  return auth.handler(request)
}
