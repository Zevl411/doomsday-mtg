import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getCardsByExactNames,
  getCardsByIds,
  getCardsByOracleIds,
  getCardById,
  getCardPrintings,
  searchCards,
} from './scryfall';

import type { ScryfallCard } from '../types/card';

const solRing: ScryfallCard = {
  id: 'sol-ring',
  name: 'Sol Ring',
  type_line: 'Artifact',
  color_identity: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Scryfall client', () => {
  it('can return one result for each unique artwork', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [solRing] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchCards('Sol Ring', undefined, 'art')).resolves.toEqual([solRing]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.scryfall.com/cards/search?q=Sol%20Ring&unique=art',
    );
  });

  it('loads one exact printing for current marketplace data', async () => {
    const pricedCard = {
      ...solRing,
      id: '00000000-0000-4000-8000-000000000001',
      prices: { usd: '1.25', usd_foil: '4.50' },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => pricedCard,
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCardById(pricedCard.id)).resolves.toEqual(pricedCard);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.scryfall.com/cards/${pricedCard.id}`,
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it('deduplicates names in a collection request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [solRing] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const cards = await getCardsByExactNames([' Sol Ring ', 'sol ring', '']);

    expect(cards).toEqual([solRing]);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      identifiers: [{ name: 'Sol Ring' }],
    });
  });

  it('loads card images by deduplicated Oracle identity', async () => {
    const oracleId = '00000000-0000-4000-8000-000000000001';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [{ ...solRing, oracle_id: oracleId }] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const cards = await getCardsByOracleIds([oracleId, oracleId]);

    expect(cards).toHaveLength(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      identifiers: [{ oracle_id: oracleId }],
    });
  });

  it('loads exact printings in one deduplicated collection request', async () => {
    const printingId = '00000000-0000-4000-8000-000000000002';
    const printing = { ...solRing, id: printingId, prices: { usd: '1.00' } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [printing] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCardsByIds([printingId, printingId])).resolves.toEqual([printing]);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      identifiers: [{ id: printingId }],
    });
  });

  it('requests all paper printings by Oracle identity', async () => {
    const printing = {
      ...solRing,
      id: 'sol-ring-retro',
      oracle_id: 'sol-ring-oracle',
      set: 'brc',
      set_name: 'The Brothers’ War Commander',
      collector_number: '127',
      released_at: '2022-11-18',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        data: [printing],
        has_more: false,
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getCardPrintings({
        ...solRing,
        oracle_id: 'sol-ring-oracle',
      }),
    ).resolves.toEqual([printing]);

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/cards/search');
    expect(url.searchParams.get('q')).toBe('oracleid:sol-ring-oracle game:paper lang:en');
    expect(url.searchParams.get('unique')).toBe('prints');
    expect(url.searchParams.get('order')).toBe('released');
  });

  it('follows Scryfall printing pages and removes duplicate records', async () => {
    const nextPage = 'https://api.scryfall.com/cards/search?page=2&q=oracleid%3Asol-ring';
    const firstPrinting = {
      ...solRing,
      id: 'first-printing',
      oracle_id: 'sol-ring-oracle',
    };
    const secondPrinting = {
      ...solRing,
      id: 'second-printing',
      oracle_id: 'sol-ring-oracle',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [firstPrinting],
          has_more: true,
          next_page: nextPage,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [firstPrinting, secondPrinting],
          has_more: false,
        }),
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getCardPrintings({
        ...solRing,
        oracle_id: 'sol-ring-oracle',
      }),
    ).resolves.toEqual([firstPrinting, secondPrinting]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns a clear message for HTTP 429 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response),
    );

    await expect(searchCards('Sol Ring')).rejects.toThrow('temporarily rate-limiting');
  });

  it('turns network failures into a readable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(searchCards('Sol Ring')).rejects.toThrow('Unable to reach Scryfall');
  });

  it('rejects a successful response with an invalid card shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ id: 'missing-required-fields' }] }),
      } as Response),
    );

    await expect(searchCards('Sol Ring')).rejects.toThrow('returned an unexpected response');
  });

  it('falls back to exact-name lookup for a flavor name', async () => {
    const flavorPrinting = {
      ...solRing,
      name: 'Cyclonic Rift',
      flavor_name: "Hope's Aero Magic",
    };
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
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const cards = await getCardsByExactNames(["Hope's Aero Magic"]);

    expect(cards).toEqual([flavorPrinting]);
    const fallbackUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(fallbackUrl.pathname).toBe('/cards/named');
    expect(fallbackUrl.searchParams.get('exact')).toBe("Hope's Aero Magic");
  });

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
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [modalCard] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await getCardsByExactNames(['Sink into Stupor // Soporific Springs']);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      identifiers: [{ name: 'Sink into Stupor' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
