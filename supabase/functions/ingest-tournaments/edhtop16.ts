import type {
  ProviderListOptions,
  ProviderTournament,
  ProviderTournamentEntry,
  TournamentProvider,
} from './types.ts';

const DEFAULT_BASE_URL = 'https://edhtop16.com';
const TOURNAMENT_PAGE_SIZE = 100;
const MAX_TOURNAMENT_PAGES = 100;
const TOURNAMENTS_QUERY = `
  query DoomsdayTournamentArchive(
    $after: String
    $first: Int!
    $filters: TournamentFilters
    $sortBy: TournamentSortBy!
  ) {
    tournaments(
      after: $after
      first: $first
      filters: $filters
      sortBy: $sortBy
    ) {
      edges {
        cursor
        node {
          id
          TID
          name
          size
          tournamentDate
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
const TOURNAMENT_ENTRIES_QUERY = `
  query DoomsdayTournamentEntries($tournamentId: String!) {
    tournament(TID: $tournamentId) {
      entries {
        id
        standing
        wins
        losses
        draws
        decklist
        player {
          id
          name
        }
        commander {
          name
          colorId
        }
      }
    }
  }
`;

/**
 * EDHTop16 transport is isolated here because its response contract may evolve
 * independently from DoomsdayMTG's normalized database.
 */
export class EdhTop16Provider implements TournamentProvider {
  readonly source = 'edhtop16' as const;
  private readonly baseUrl: string;
  private readonly request: typeof fetch;

  constructor(baseUrl = DEFAULT_BASE_URL, request: typeof fetch = fetch) {
    this.baseUrl = baseUrl;
    this.request = request;
  }

  async listTournaments(options: ProviderListOptions): Promise<ProviderTournament[]> {
    const unique = new Map<string, ProviderTournament>();
    let cursor: string | null = null;

    for (let page = 0; page < MAX_TOURNAMENT_PAGES; page += 1) {
      const connection = await this.getTournamentPage(options, cursor);

      for (const edge of connection.edges) {
        const tournament = mapTournament(edge.node);
        if (!tournament || !matchesOptions(tournament, options)) continue;
        tournament.url ??= new URL(
          `/tournament/${encodeURIComponent(tournament.sourceTournamentId)}`,
          this.baseUrl,
        ).toString();
        unique.set(tournament.sourceTournamentId, tournament);
      }

      if (!connection.pageInfo.hasNextPage) {
        return [...unique.values()];
      }

      const nextCursor = connection.pageInfo.endCursor;
      if (!nextCursor || nextCursor === cursor) {
        throw new Error('EDHTop16 pagination returned an invalid cursor.');
      }
      cursor = nextCursor;
    }

    throw new Error(`EDHTop16 returned more than ${MAX_TOURNAMENT_PAGES} tournament pages.`);
  }

  async listEntries(tournament: ProviderTournament): Promise<ProviderTournamentEntry[]> {
    const unique = new Map<string, ProviderTournamentEntry>();
    const rows = await this.getTournamentEntries(tournament.sourceTournamentId);
    for (const row of rows) {
      const entry = mapEntry(row);
      if (!entry) continue;
      const identity =
        entry.sourceEntryId ??
        `${entry.playerExternalId ?? entry.playerName}|${entry.commanderName}`;
      unique.set(identity, entry);
    }
    return [...unique.values()];
  }

  private async getTournamentPage(
    options: ProviderListOptions,
    cursor: string | null,
  ): Promise<TournamentConnection> {
    const response = await this.requestWithRetry(new URL('/api/graphql', this.baseUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: TOURNAMENTS_QUERY,
        variables: {
          after: cursor,
          first: TOURNAMENT_PAGE_SIZE,
          filters: {
            minDate: options.startDate,
            maxDate: options.endDate ? endOfDay(options.endDate) : undefined,
            minSize: options.minimumPlayers,
          },
          sortBy: 'DATE',
        },
      }),
    });
    const body: unknown = await response.json();
    const connection = readTournamentConnection(body);
    if (!connection) {
      throw new Error('EDHTop16 returned an invalid tournament page.');
    }
    return connection;
  }

  private async getTournamentEntries(tournamentId: string): Promise<unknown[]> {
    const response = await this.requestWithRetry(new URL('/api/graphql', this.baseUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: TOURNAMENT_ENTRIES_QUERY,
        variables: { tournamentId },
      }),
    });
    const body: unknown = await response.json();
    if (
      !isRecord(body) ||
      !isRecord(body.data) ||
      !isRecord(body.data.tournament) ||
      !Array.isArray(body.data.tournament.entries)
    ) {
      throw new Error('EDHTop16 returned invalid tournament entries.');
    }
    return body.data.tournament.entries;
  }

  private async requestWithRetry(url: URL, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.request(url, init);
      if (response.ok) return response;
      if (response.status !== 429 || attempt === 2) {
        throw new Error(`EDHTop16 request failed with ${response.status}.`);
      }
      // Retry-After is preferred; bounded exponential delay is the fallback.
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error('EDHTop16 request failed.');
  }
}

interface TournamentConnection {
  edges: Array<{ node: unknown }>;
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
}

function readTournamentConnection(value: unknown): TournamentConnection | null {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const connection = value.data.tournaments;
  if (
    !isRecord(connection) ||
    !Array.isArray(connection.edges) ||
    !isRecord(connection.pageInfo) ||
    typeof connection.pageInfo.hasNextPage !== 'boolean'
  ) {
    return null;
  }

  const edges = connection.edges.filter(isRecord).map((edge) => ({ node: edge.node }));
  const endCursor = connection.pageInfo.endCursor;
  return {
    edges,
    pageInfo: {
      endCursor: typeof endCursor === 'string' ? endCursor : null,
      hasNextPage: connection.pageInfo.hasNextPage,
    },
  };
}

function matchesOptions(tournament: ProviderTournament, options: ProviderListOptions): boolean {
  if (
    options.tournamentIds?.length &&
    !options.tournamentIds.includes(tournament.sourceTournamentId)
  ) {
    return false;
  }
  if (tournament.playerCount !== null && tournament.playerCount < options.minimumPlayers) {
    return false;
  }
  if (
    options.startDate &&
    tournament.date &&
    tournament.date < new Date(options.startDate).toISOString()
  ) {
    return false;
  }
  return !(options.endDate && tournament.date && tournament.date >= endOfDay(options.endDate));
}

function mapTournament(value: unknown): ProviderTournament | null {
  if (!isRecord(value)) return null;
  const id = readString(value, ['TID', 'tournamentId', 'id']);
  const name = readString(value, ['name', 'tournamentName']);
  if (!id || !name) return null;
  return {
    sourceTournamentId: id,
    name,
    date: readDate(value, ['tournamentDate', 'date', 'eventDate', 'startDate']),
    playerCount: readNumber(value, ['size', 'playerCount', 'players']),
    url: readString(value, ['url', 'tournamentUrl']),
    sourceUpdatedAt: readDate(value, ['updatedAt', 'dateUpdated']) ?? undefined,
    raw: value,
  };
}

function mapEntry(value: unknown): ProviderTournamentEntry | null {
  if (!isRecord(value)) return null;
  const commander = isRecord(value.commander) ? value.commander : null;
  const commanderValue = commander ? commander.name : value.commander;
  const commanderName =
    typeof commanderValue === 'string' && commanderValue.trim()
      ? commanderValue.trim()
      : readString(value, ['commanderName', 'deck']);
  if (!commanderName) return null;
  return {
    sourceEntryId: readString(value, ['id', 'entryId']),
    playerName:
      readNestedString(value, 'player', 'name') ??
      readString(value, ['playerName', 'name', 'pilot']),
    playerExternalId:
      readNestedString(value, 'player', 'id') ?? readString(value, ['playerId', 'profileId']),
    commanderName,
    colorIdentity: readColors(commander?.colorId ?? value.colorIdentity ?? value.colors),
    standing: readNumber(value, ['standing', 'place', 'rank']) ?? undefined,
    wins: readNumber(value, ['wins', 'win']) ?? 0,
    losses: readNumber(value, ['losses', 'loss']) ?? 0,
    draws: readNumber(value, ['draws', 'draw']) ?? 0,
    decklistUrl: readString(value, ['decklist', 'decklistUrl', 'deckUrl', 'url']),
    raw: value,
  };
}

function readString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return value[key].trim();
    }
  }
  return undefined;
}

function readNumber(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const number = Number(value[key]);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return null;
}

function readDate(value: Record<string, unknown>, keys: string[]) {
  const text = readString(value, keys);
  if (!text || Number.isNaN(Date.parse(text))) return null;
  return new Date(text).toISOString();
}

function readColors(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((color): color is string => typeof color === 'string');
  }
  return typeof value === 'string'
    ? (value.match(/[WUBRG]/gi)?.map((color) => color.toUpperCase()) ?? [])
    : [];
}

function readNestedString(value: Record<string, unknown>, parent: string, child: string) {
  const nested = value[parent];
  return isRecord(nested) && typeof nested[child] === 'string' ? nested[child].trim() : undefined;
}

/**
 * Next/Relay emits JSON records inside the server-rendered HTML stream.
 * This balanced scanner extracts only arrays assigned to a requested field;
 * it does not depend on visual markup or scrape rendered text.
 */
export function extractEmbeddedArrays(html: string, field: string): unknown[][] {
  const arrays: unknown[][] = [];
  const marker = `"${field}":`;
  let searchFrom = 0;
  while (searchFrom < html.length) {
    const markerIndex = html.indexOf(marker, searchFrom);
    if (markerIndex < 0) break;
    const start = html.indexOf('[', markerIndex + marker.length);
    if (start < 0) break;
    const text = readBalancedArray(html, start);
    searchFrom = start + Math.max(text.length, 1);
    if (!text) continue;
    try {
      const value: unknown = JSON.parse(text);
      if (Array.isArray(value)) arrays.push(value);
    } catch {
      // Query metadata and incomplete streamed chunks are intentionally ignored.
    }
  }
  return arrays;
}

function readBalancedArray(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '[') depth += 1;
    else if (character === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return '';
}

function endOfDay(date: string) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export { mapEntry, mapTournament };
