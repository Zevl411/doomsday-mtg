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

  it('rejects a successful response with an invalid card shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ id: 'missing-required-fields' }] }),
      } as Response),
    )

    await expect(searchCards('Sol Ring')).rejects.toThrow(
      'returned an unexpected response',
    )
  })

  it('falls back to exact-name lookup for a flavor name', async () => {
    const flavorPrinting = {
      ...solRing,
      name: 'Cyclonic Rift',
      flavor_name: "Hope's Aero Magic",
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [],
          not_found: [{ name: "Hope's Aero Magic" }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => flavorPrinting,
      } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const cards = await getCardsByExactNames(["Hope's Aero Magic"])

    expect(cards).toEqual([flavorPrinting])
    const fallbackUrl = new URL(String(fetchMock.mock.calls[1]?.[0]))
    expect(fallbackUrl.pathname).toBe('/cards/named')
    expect(fallbackUrl.searchParams.get('exact')).toBe("Hope's Aero Magic")
  })

  it('uses the front face for collection lookup', async () => {
    const modalCard: ScryfallCard = {
      id: 'modal-card',
      name: 'Sink into Stupor // Soporific Springs',
      type_line: 'Instant // Land',
      color_identity: ['U'],
      card_faces: [
        { name: 'Sink into Stupor', type_line: 'Instant' },
        { name: 'Soporific Springs', type_line: 'Land' },
      ],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [modalCard] }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    await getCardsByExactNames([
      'Sink into Stupor // Soporific Springs',
    ])

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      identifiers: [{ name: 'Sink into Stupor' }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
