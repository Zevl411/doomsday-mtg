import { extractCommanders } from './commanderExtraction.ts'
import { normalizeTournamentLocation } from './location.ts'
import type {
  ProviderListOptions,
  ProviderRequestMetrics,
  ProviderTournament,
  ProviderTournamentEntry,
  TournamentProvider,
} from './types.ts'

interface TopDeckProviderOptions {
  apiKey: string
  baseUrl?: string
  fetcher?: typeof fetch
  wait?: (milliseconds: number) => Promise<void>
}

/**
 * TopDeck stays behind the provider interface so its private credential and
 * response shape never reach the Vue application.
 */
export class TopDeckProvider implements TournamentProvider {
  source = 'topdeck' as const
  private cachedStandings = new Map<string, unknown[]>()
  private metrics: ProviderRequestMetrics = {
    requestsMade: 0,
    retries: 0,
    rateLimitedRequests: 0,
    exhaustedRequests: 0,
  }

  constructor(private options: TopDeckProviderOptions) {
    if (!options.apiKey) throw new Error('TOPDECK_API_KEY is not configured.')
  }

  async listTournaments(
    options: ProviderListOptions,
  ): Promise<ProviderTournament[]> {
    // An empty TID array still activates TopDeck's TID mode and disables date
    // filters. Treat it as absent so a blank admin field performs discovery.
    const tournamentIds = options.tournamentIds?.filter(Boolean)
    const body = {
      game: 'Magic: The Gathering',
      format: 'EDH',
      start: toUnixSeconds(options.startDate),
      // Date inputs describe whole calendar days. Move the upper bound to the
      // final second so evening tournaments are not lost from each batch.
      end: toUnixSeconds(options.endDate, true),
      last: options.last,
      participantMin: options.minimumPlayers,
      participantMax: options.maximumPlayers,
      TID: tournamentIds?.length === 1
        ? tournamentIds[0]
        : tournamentIds?.length ? tournamentIds : undefined,
      columns: standingColumns(),
      rounds: options.includeRounds === true,
    }
    const response = await this.request('/v2/tournaments', {
      method: 'POST',
      body: JSON.stringify(removeUndefined(body)),
    })
    const tournaments = readArray(response, ['data', 'tournaments'])

    return Promise.all(tournaments.map(async (raw) => {
      const tournament = isRecord(raw) ? raw : {}
      const id = readString(tournament, ['TID', 'tid', 'id'])
      if (!id) throw new Error('TopDeck returned a tournament without a TID.')
      const standings = readArray(tournament, ['standings', 'players', 'entries'])
      this.cachedStandings.set(id, standings)
      let location = normalizeTopDeckLocation(tournament)
      if (
        options.enrichLocation &&
        location.locationPrecision === 'unknown'
      ) {
        const info = await this.request(`/v2/tournaments/${encodeURIComponent(id)}/info`)
        if (isRecord(info)) location = normalizeTopDeckLocation(info, 'topdeck-info')
      }
      return {
        sourceTournamentId: id,
        name: readString(tournament, ['tournamentName', 'name']) ??
          `TopDeck tournament ${id}`,
        date: readDate(tournament.startDate ?? tournament.date),
        playerCount: readNumber(
          tournament,
          ['participantCount', 'playerCount'],
        ) ?? standings.length,
        url: readString(tournament, ['url', 'sourceUrl']) ??
          `https://topdeck.gg/event/${encodeURIComponent(id)}`,
        sourceUpdatedAt: readDate(
          tournament.updatedAt ?? tournament.lastUpdated,
        ) ?? undefined,
        location,
        raw,
      }
    }))
  }

  async listEntries(
    tournament: ProviderTournament,
  ): Promise<ProviderTournamentEntry[]> {
    const standings = this.cachedStandings.get(tournament.sourceTournamentId) ??
      readArray(tournament.raw, ['standings', 'players', 'entries'])
    return standings.map((raw, index) => mapStanding(raw, index))
  }

  getMetrics() {
    return { ...this.metrics }
  }

  private async request(path: string, init: RequestInit = {}) {
    const fetcher = this.options.fetcher ?? fetch
    const wait = this.options.wait ??
      ((milliseconds: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
    const baseUrl = (this.options.baseUrl ?? 'https://topdeck.gg/api')
      .replace(/\/$/, '')

    for (let attempt = 0; attempt < 4; attempt += 1) {
      this.metrics.requestsMade += 1
      const response = await fetcher(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: this.options.apiKey,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      })
      if (response.ok) return response.json()
      if (response.status !== 429 && response.status < 500) {
        throw new Error(
          `TopDeck request failed (${response.status}): ${await readPublicError(response)}`,
        )
      }
      if (response.status === 429) this.metrics.rateLimitedRequests += 1
      if (attempt === 3) {
        this.metrics.exhaustedRequests += 1
        throw new Error(`TopDeck request failed after retries (${response.status}).`)
      }
      this.metrics.retries += 1
      const retryAfter = Number(response.headers.get('Retry-After'))
      await wait(Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * 2 ** attempt)
    }
    throw new Error('TopDeck request failed.')
  }
}

function standingColumns() {
  return [
    'name',
    'id',
    'decklist',
    'wins',
    'draws',
    'losses',
    'winRate',
  ]
}

function mapStanding(raw: unknown, index: number): ProviderTournamentEntry {
  const standing = isRecord(raw) ? raw : {}
  const decklist = standing.decklist
  const deckObject = standing.deckObj ?? standing.deckObject
  const extraction = extractCommanders(decklist, deckObject)
  const commanderName = extraction.names.join(' // ') || 'Unknown commander'
  return {
    sourceEntryId: readString(standing, ['id', 'standingId']) ??
      `standing-${index + 1}`,
    playerName: readString(standing, ['name', 'playerName']) ?? undefined,
    playerExternalId: readString(standing, ['id', 'playerId']) ?? undefined,
    commanderName,
    colorIdentity: [
      ...new Set([
        ...readStringArray(standing.colorIdentity ?? standing.color_identity),
        ...readCommanderColorIdentity(deckObject),
      ]),
    ],
    standing: readNumber(standing, ['standing', 'rank', 'place']) ?? index + 1,
    wins: readNumber(standing, ['wins']) ?? 0,
    losses: readNumber(standing, ['losses']) ?? 0,
    draws: readNumber(standing, ['draws']) ?? 0,
    decklistUrl: readString(standing, ['decklistUrl', 'decklist_url']) ??
      (typeof decklist === 'string' && /^https?:\/\//.test(decklist)
        ? decklist
        : undefined),
    commanderExtractionStatus: extraction.status,
    decklistAvailability: isRecord(deckObject)
      ? 'structured'
      : typeof decklist === 'string' && decklist.trim()
        ? /^https?:\/\//.test(decklist) ? 'url' : 'plaintext'
        : 'missing',
    raw,
  }
}

function normalizeTopDeckLocation(value: Record<string, unknown>, source = 'topdeck-bulk') {
  const eventData = isRecord(value.eventData) ? value.eventData : {}
  const information = isRecord(value.tournamentInfo)
    ? value.tournamentInfo
    : isRecord(value.info) ? value.info : value
  const location = isRecord(information.location) ? information.location : {}
  return normalizeTournamentLocation({
    venueName: location.name ?? information.venueName,
    city: location.city ?? eventData.city,
    stateRegion: location.state ?? eventData.state,
    country: location.country ?? eventData.country,
    latitude: location.lat ?? eventData.lat,
    longitude: location.lng ?? eventData.lng,
    address: location.address ?? eventData.address,
    source,
  })
}

function toUnixSeconds(value: string | undefined, endOfDay = false) {
  if (!value) return undefined
  const date = new Date(value)
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCDate(date.getUTCDate() + 1)
    return Math.floor(date.getTime() / 1000) - 1
  }
  return Math.floor(date.getTime() / 1000)
}

function readDate(value: unknown) {
  if (typeof value === 'number') {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value
    return new Date(milliseconds).toISOString()
  }
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString()
  }
  return null
}

function readArray(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return []
  for (const key of keys) if (Array.isArray(value[key])) return value[key]
  return []
}

function readString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const item = value[key]
    if ((typeof item === 'string' || typeof item === 'number') && `${item}`.trim()) {
      return `${item}`.trim()
    }
  }
  return null
}

function readNumber(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const item = Number(value[key])
    if (Number.isFinite(item)) return item
  }
  return null
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function readCommanderColorIdentity(deckObject: unknown) {
  if (!isRecord(deckObject)) return []
  const section = deckObject.Commanders ?? deckObject.commanders
  if (!isRecord(section)) return []
  return Object.values(section).flatMap((card) => {
    if (!isRecord(card)) return []
    return readStringArray(card.color_identity ?? card.colorIdentity)
  })
}

function removeUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  )
}

async function readPublicError(response: Response) {
  try {
    const body: unknown = await response.clone().json()
    if (isRecord(body) && typeof body.error === 'string') {
      // Provider errors contain request validation details, never our API key.
      return body.error.slice(0, 300)
    }
  } catch {
    // Fall back to a stable message for HTML or empty responses.
  }
  return 'The provider rejected the request.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
