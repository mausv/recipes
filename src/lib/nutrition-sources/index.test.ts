import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchNutrition } from '.'
import { searchOff } from './off'
import type { NutritionResult } from './types'
import { searchUsda } from './usda'

vi.mock('./off', () => ({ searchOff: vi.fn() }))
vi.mock('./usda', () => ({ searchUsda: vi.fn() }))

function result(source: NutritionResult['source'], name: string): NutritionResult {
  return {
    source,
    sourceId: name,
    name,
    brand: null,
    per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0, fiber: null },
  }
}

beforeEach(() => {
  vi.mocked(searchOff).mockResolvedValue([result('off', 'Off oats')])
  vi.mocked(searchUsda).mockResolvedValue([result('usda', 'Usda oats')])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('searchNutrition', () => {
  it('only searches Open Food Facts when no USDA key is set', async () => {
    vi.stubEnv('USDA_API_KEY', '')
    const results = await searchNutrition('oats')
    expect(searchUsda).not.toHaveBeenCalled()
    expect(results.map((r) => r.name)).toEqual(['Off oats'])
  })

  it('searches both sources when a USDA key is set', async () => {
    vi.stubEnv('USDA_API_KEY', 'key')
    const results = await searchNutrition('oats')
    expect(results.map((r) => r.name)).toEqual(['Off oats', 'Usda oats'])
  })

  it('passes the query and API key to USDA', async () => {
    vi.stubEnv('USDA_API_KEY', 'key')
    await searchNutrition('oats')
    expect(searchUsda).toHaveBeenCalledWith('oats', 'key', expect.any(AbortSignal))
  })

  it('gives each source its own abort signal', async () => {
    vi.stubEnv('USDA_API_KEY', 'key')
    await searchNutrition('oats')
    const offSignal = vi.mocked(searchOff).mock.calls[0][1]
    const usdaSignal = vi.mocked(searchUsda).mock.calls[0][2]
    expect(offSignal).not.toBe(usdaSignal)
  })

  it('gives each source a six-second timeout signal', async () => {
    vi.stubEnv('USDA_API_KEY', '')
    const signal = AbortSignal.abort()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal)
    await searchNutrition('oats')
    expect(timeout).toHaveBeenCalledWith(6000)
    expect(searchOff).toHaveBeenCalledWith('oats', signal)
  })

  it('returns no results from a source that times out', async () => {
    vi.stubEnv('USDA_API_KEY', '')
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())
    vi.mocked(searchOff).mockImplementation(async (_q, signal) => {
      signal.throwIfAborted()
      return []
    })
    expect(await searchNutrition('oats')).toEqual([])
  })

  it('still returns the other source’s results when one fails', async () => {
    vi.stubEnv('USDA_API_KEY', 'key')
    vi.mocked(searchOff).mockRejectedValue(new Error('down'))
    const results = await searchNutrition('oats')
    expect(results.map((r) => r.name)).toEqual(['Usda oats'])
  })

  it('logs the failing source’s error', async () => {
    vi.stubEnv('USDA_API_KEY', 'key')
    const error = new Error('down')
    vi.mocked(searchUsda).mockRejectedValue(error)
    await searchNutrition('oats')
    expect(console.error).toHaveBeenCalledWith('Nutrition source failed:', error)
  })

  it('returns an empty list when every source fails', async () => {
    vi.stubEnv('USDA_API_KEY', 'key')
    vi.mocked(searchOff).mockRejectedValue(new Error('down'))
    vi.mocked(searchUsda).mockRejectedValue(new Error('down'))
    expect(await searchNutrition('oats')).toEqual([])
  })
})
