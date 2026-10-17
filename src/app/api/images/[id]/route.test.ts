import fs from 'node:fs'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '@/lib/session'
import { pngBuffer, sessionFor, setupTestDb } from '@/test/db'

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))

const { insertUser } = await setupTestDb()
const { imagePath, saveImage } = await import('@/lib/images')
const { GET } = await import('./route')

const user = insertUser()

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(sessionFor(user))
})

function get(id: string) {
  return GET(new NextRequest(`http://localhost/api/images/${id}`), {
    params: Promise.resolve({ id }),
  })
}

describe('GET /api/images/[id]', () => {
  it('returns the stored image bytes', async () => {
    const saved = await saveImage(await pngBuffer())
    const res = await get(saved.id)
    expect(Buffer.from(await res.arrayBuffer())).toEqual(fs.readFileSync(imagePath(saved.id)))
  })

  it('serves the image as webp', async () => {
    const saved = await saveImage(await pngBuffer())
    expect((await get(saved.id)).headers.get('content-type')).toBe('image/webp')
  })

  it('lets the browser cache the image for a year', async () => {
    const saved = await saveImage(await pngBuffer())
    expect((await get(saved.id)).headers.get('cache-control')).toBe(
      'private, max-age=31536000, immutable'
    )
  })

  it('returns 404 for an unknown id', async () => {
    expect((await get(crypto.randomUUID())).status).toBe(404)
  })

  it('returns 404 when the row exists but the file is missing', async () => {
    const saved = await saveImage(await pngBuffer())
    fs.rmSync(imagePath(saved.id))
    expect((await get(saved.id)).status).toBe(404)
  })

  it('does not resolve ids that point outside the images folder', async () => {
    expect((await get('../recipes.db')).status).toBe(404)
  })

  it('returns 401 without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const saved = await saveImage(await pngBuffer())
    expect((await get(saved.id)).status).toBe(401)
  })
})
