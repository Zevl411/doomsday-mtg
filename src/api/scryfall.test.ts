import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScryfallCard } from '../types/card'
import {
  getCardsByExactNames,
  searchCards,
} from './scryfall'

const solRing: ScryfallCard = {
  id: 'sol-ring',
  name: 'Sol Ring',
  type_line: 'Artifact',
  color_identity: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Scryfall client', () => {
  it('deduplicates names in a collection request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [solRing] }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const cards = await getCardsByExactNames([
      ' Sol Ring ',
      'sol ring',
      '',
    ])

    expect(cards).toEqual([solRing])
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      identifiers: [{ name: 'Sol Ring' }],
    })
  })

  it('returns a clear message for HTTP 429 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response),
    )

    await expect(searchCards('Sol Ring')).rejects.toThrow(
      'temporarily rate-limiting',
    )
  })

  it('turns network failures into a readable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    await expect(searchCards('Sol Ring')).rejects.toThrow(
      'Unable to reach Scryfall',
    )
  })
})
