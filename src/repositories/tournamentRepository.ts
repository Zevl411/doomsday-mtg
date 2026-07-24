import { getCardsByExactNames } from '../api/scryfall';
import { supabase } from '../lib/supabase';
import {
  getCommanderColorIdentity,
  getCommanderLookupNames,
  mapColorIdentityByCardName,
} from '../utils/commanderColorIdentity';
import {
  applyScryfallCardDetails,
  groupTournamentDeckCards,
  hasExpectedTournamentDeckCards,
} from '../utils/tournamentDeckCards';
import { displayRegionKey } from '../utils/tournamentLocation';

import type {
  CommanderMetagameStats,
  MetagameFilters,
  Tournament,
  TournamentEntryDecklist,
  TournamentEntry,
  RegionalMetagameStats,
  NormalizedTournamentDeck,
  CommanderCardInclusion,
  CardInclusionHistoryPoint,
  CardInclusionPeriod,
  CardInclusionFilters,
} from '../models/tournament';

export interface TournamentDetail {
  tournament: Tournament;
  entries: TournamentEntry[];
}

export interface CommanderDetail {
  stats: CommanderMetagameStats | null;
  entries: TournamentEntry[];
}

export interface CommanderIdentitySummary {
  name: string;
  colorIdentity: string[];
  imageUrls: string[];
}

const metagameCache = new Map<string, CommanderMetagameStats[]>();
const entryDecklistCache = new Map<string, TournamentEntryDecklist>();
const commanderColorCache = new Map<string, string[]>();
const commanderImageCache = new Map<string, string>();
const commanderPrintingCache = new Map<string, string>();
const inclusionImageCache = new Map<
  string,
  {
    imageUrl?: string;
    backImageUrl?: string;
  }
>();

/** Queries only normalized public tables and shields views from Supabase rows. */
export const tournamentRepository = {
  async getCommanderMetagame(filters: MetagameFilters = {}): Promise<CommanderMetagameStats[]> {
    requireSupabase();
    const normalized = normalizeFilters(filters);
    const cacheKey = JSON.stringify(normalized);
    const cached = metagameCache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase!.rpc('get_commander_metagame', {
      start_date: normalized.startDate ?? null,
      end_date: normalized.endDate ?? null,
      minimum_players: normalized.minimumPlayers,
      minimum_entries: normalized.minimumEntries,
      top_finish_threshold: normalized.topFinishThreshold,
      country_filter: null,
      state_filter: null,
      region_filter: null,
      online_filter: null,
    });
    if (error) throw friendlyError('load Commander metagame', error);

    // Provider rows without a resolved Commander are not useful metagame
    // choices and can otherwise dominate lists after a large ingestion.
    const result = ((data ?? []) as MetagameRow[])
      .map(mapMetagameRow)
      .filter(hasRegisteredCommander);
    await enrichCommanderColorIdentities(result);
    metagameCache.set(cacheKey, result);
    return result;
  },

  async getCommanderDetails(
    commanderKey: string,
    filters: MetagameFilters = {},
  ): Promise<CommanderDetail> {
    requireSupabase();
    const stats = await this.getCommanderMetagame({
      ...filters,
      minimumEntries: 1,
    });
    let query = supabase!
      .from('tournament_entries')
      .select('*, tournaments!inner(*), tournament_decks(id)')
      .eq('commander_key', commanderKey)
      .order('event_date', { referencedTable: 'tournaments', ascending: false })
      .limit(100);
    if (filters.startDate) {
      query = query.gte('tournaments.event_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('tournaments.event_date', filters.endDate);
    }
    if (filters.minimumPlayers) {
      query = query.gte('tournaments.player_count', filters.minimumPlayers);
    }
    const { data, error } = await query;
    if (error) throw friendlyError('load Commander details', error);

    const entries = ((data ?? []) as EntryRow[]).map(mapEntryRow);
    await enrichCommanderColorIdentities(entries);
    return {
      stats: stats.find((item) => item.commanderKey === commanderKey) ?? null,
      entries,
    };
  },

  async getRecentTournaments(filters: MetagameFilters = {}): Promise<Tournament[]> {
    requireSupabase();
    let query = supabase!.from('tournament_summaries').select('*');
    if (filters.startDate) query = query.gte('event_date', filters.startDate);
    if (filters.endDate) query = query.lte('event_date', filters.endDate);
    if (filters.minimumPlayers !== undefined) {
      query = query.gte('player_count', filters.minimumPlayers);
    }
    if (filters.maximumPlayers !== undefined) {
      query = query.lte('player_count', filters.maximumPlayers);
    }
    query = query
      .order(filters.tournamentSort === 'player-count' ? 'player_count' : 'event_date', {
        ascending: filters.sortAscending ?? false,
        nullsFirst: false,
      })
      .limit(100);
    const { data, error } = await query;
    if (error) throw friendlyError('load tournaments', error);
    return ((data ?? []) as TournamentRow[]).map(mapTournamentRow);
  },

  async getRegionalMetagame(filters: MetagameFilters = {}): Promise<RegionalMetagameStats[]> {
    requireSupabase();
    const { data, error } = await supabase!.rpc('get_regional_metagame', {
      start_date: filters.startDate || null,
      end_date: filters.endDate || null,
      minimum_players: Math.max(0, filters.minimumPlayers ?? 0),
    });
    if (error) throw friendlyError('load regional metagame', error);
    return ((data ?? []) as RegionalRow[]).map((row) => ({
      regionKey: row.region_key,
      displayName: displayRegionKey(row.region_key),
      tournaments: Number(row.tournaments),
      entries: Number(row.entries),
      uniqueCommanders: Number(row.unique_commanders),
      topCommander: row.top_commander,
      topCommanderEntries: Number(row.top_commander_entries),
      averageTournamentSize: Number(row.average_tournament_size ?? 0),
    }));
  },

  async getCommanderCardInclusion(
    commanderKey: string,
    filters: CardInclusionFilters = {},
  ): Promise<CommanderCardInclusion[]> {
    requireSupabase();
    const { data, error } = await supabase!.rpc('get_commander_card_inclusion', {
      target_commander_key: commanderKey,
      start_date: filters.startDate || null,
      end_date: filters.endDate || null,
      minimum_tournament_size: Math.max(0, filters.minimumPlayers ?? 0),
      country_filter: null,
      state_filter: null,
      region_filter: null,
      online_filter: null,
      maximum_standing: filters.maximumStanding ?? null,
      minimum_complete_decks: Math.max(1, filters.minimumCompleteDecks ?? 1),
    });
    if (error) throw friendlyError('load Commander card inclusion', error);
    const rows = parseCommanderInclusionRows(data ?? []);
    await enrichInclusionCardImages(rows);
    return rows;
  },

  async getCardInclusionOverTime(
    commanderKey: string,
    card: Pick<CommanderCardInclusion, 'oracleId' | 'normalizedCardKey'>,
    period: CardInclusionPeriod,
    filters: CardInclusionFilters = {},
  ): Promise<CardInclusionHistoryPoint[]> {
    requireSupabase();
    const { data, error } = await supabase!.rpc('get_commander_card_inclusion_over_time', {
      target_commander_key: commanderKey,
      target_oracle_id: card.oracleId ?? null,
      target_normalized_card_key: card.normalizedCardKey,
      time_bucket: period,
      start_date: filters.startDate || null,
      end_date: filters.endDate || null,
      minimum_tournament_size: Math.max(0, filters.minimumPlayers ?? 0),
      country_filter: null,
      state_filter: null,
      region_filter: null,
      online_filter: null,
      maximum_standing: filters.maximumStanding ?? null,
    });
    if (error) throw friendlyError('load card inclusion history', error);
    return parseCardInclusionHistoryRows(data ?? []);
  },

  async getCommanderIdentity(commanderKey: string): Promise<CommanderIdentitySummary | null> {
    requireSupabase();
    const { data, error } = await supabase!
      .from('tournament_entries')
      .select('commander_name, color_identity')
      .eq('commander_key', commanderKey)
      .limit(1)
      .maybeSingle();
    if (error) throw friendlyError('load Commander identity', error);
    if (!data) return null;
    if (
      !isRecord(data) ||
      typeof data.commander_name !== 'string' ||
      !isStringArrayOrNull(data.color_identity)
    ) {
      throw new Error('The Commander identity response was invalid.');
    }
    const identity: CommanderIdentitySummary = {
      name: data.commander_name,
      colorIdentity: data.color_identity ?? [],
      imageUrls: [],
    };
    try {
      const commanders = await getCardsByExactNames(getCommanderLookupNames(identity.name));
      identity.imageUrls = commanders
        .map((card) => card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal)
        .filter((url): url is string => Boolean(url));
    } catch (error) {
      // Identity text remains useful if Scryfall images are temporarily down.
      console.warn('Unable to load Commander inclusion header images.', error);
    }
    return identity;
  },

  async getNormalizedTournamentDeck(deckId: string): Promise<NormalizedTournamentDeck | null> {
    requireSupabase();
    const { data, error } = await supabase!
      .from('tournament_decks')
      .select(
        '*, tournament_deck_cards(*, canonical_cards(*)), tournament_entries!inner(*, tournaments!inner(*))',
      )
      .eq('id', deckId)
      .maybeSingle();
    if (error) throw friendlyError('load tournament Deck', error);
    if (!data) return null;
    return mapNormalizedTournamentDeck(data as unknown as TournamentDeckRow);
  },

  async getTournament(tournamentId: string): Promise<TournamentDetail | null> {
    requireSupabase();
    const [tournamentResult, entriesResult] = await Promise.all([
      supabase!.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
      supabase!
        .from('tournament_entries')
        .select('*, tournament_decks(id)')
        .eq('tournament_id', tournamentId)
        .order('standing', { ascending: true }),
    ]);
    if (tournamentResult.error) {
      throw friendlyError('load tournament', tournamentResult.error);
    }
    if (entriesResult.error) {
      throw friendlyError('load tournament entries', entriesResult.error);
    }
    if (!tournamentResult.data) return null;

    const tournament = mapTournamentRow(tournamentResult.data as TournamentRow);
    const entries = ((entriesResult.data ?? []) as EntryRow[]).map((row) => ({
      ...mapEntryRow(row),
      source: tournament.source,
    }));
    await enrichCommanderColorIdentities(entries);
    return {
      tournament,
      entries,
    };
  },

  async getEntryDecklist(entry: TournamentEntry): Promise<TournamentEntryDecklist> {
    requireSupabase();
    const cached = entryDecklistCache.get(entry.id);
    if (cached) return cached;

    // TopDeck Decks are normalized during the card-level ingestion pass.
    // Reading that snapshot avoids calling an EDHTop16-only endpoint.
    if (entry.tournamentDeckId) {
      const normalized = await this.getNormalizedTournamentDeck(entry.tournamentDeckId);
      if (normalized) {
        const storedDecklist = mapNormalizedDecklist(normalized);
        if (
          hasExpectedTournamentDeckCards(
            storedDecklist.commanders,
            storedDecklist.cards,
            normalized.mainboardCardCount,
          )
        ) {
          const decklist = await prepareTournamentDecklist(storedDecklist);
          entryDecklistCache.set(entry.id, decklist);
          return decklist;
        }
        // Older snapshots could omit DFC rows while still being marked
        // complete. Fall through to the provider-backed function for repair.
      }
    }

    const { data, error } = await supabase!.functions.invoke('tournament-decklist', {
      body: { tournamentEntryId: entry.id },
    });
    if (error) {
      throw new Error(await readFunctionError(error));
    }

    const normalizedDecklist = normalizeEntryDecklist(data);
    if (!normalizedDecklist) {
      throw new Error('The tournament decklist response was invalid.');
    }
    const decklist = await prepareTournamentDecklist(normalizedDecklist);
    entryDecklistCache.set(entry.id, decklist);
    return decklist;
  },

  clearCache() {
    metagameCache.clear();
    entryDecklistCache.clear();
    commanderColorCache.clear();
    commanderImageCache.clear();
    commanderPrintingCache.clear();
    inclusionImageCache.clear();
  },
};

async function enrichInclusionCardImages(rows: CommanderCardInclusion[]): Promise<void> {
  if (!rows.length) return;
  const missingRows = rows.filter((row) => !inclusionImageCache.has(row.normalizedCardKey));
  try {
    const scryfallCards = missingRows.length
      ? await getCardsByExactNames(missingRows.map((row) => row.cardName))
      : [];
    const imagesByName = new Map(
      scryfallCards.flatMap((card) => {
        const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
        const backImageUrl = card.card_faces?.[1]?.image_uris?.normal;
        const names = [
          card.name,
          card.flavor_name,
          card.printed_name,
          card.name.split('//')[0]?.trim(),
          ...(card.card_faces?.map((face) => face.name) ?? []),
        ].filter((name): name is string => Boolean(name));
        return names.map((name) => [name.toLocaleLowerCase(), { imageUrl, backImageUrl }] as const);
      }),
    );
    for (const row of rows) {
      const resolved = imagesByName.get(row.cardName.toLocaleLowerCase());
      if (resolved) inclusionImageCache.set(row.normalizedCardKey, resolved);
      const images = resolved ?? inclusionImageCache.get(row.normalizedCardKey);
      row.imageUrl = images?.imageUrl;
      row.backImageUrl = images?.backImageUrl;
    }
  } catch (error) {
    // Inclusion statistics remain useful during a temporary Scryfall outage.
    console.warn('Unable to load Commander inclusion card images.', error);
  }
}

/** Inclusion rows are also used by Deck comparison, so validate every field. */
export function parseCommanderInclusionRows(value: unknown): CommanderCardInclusion[] {
  if (!Array.isArray(value)) {
    throw new Error('The deck comparison response was invalid.');
  }
  return value.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.normalized_card_key !== 'string' ||
      !isNullableString(row.oracle_id) ||
      typeof row.card_name !== 'string' ||
      !isNullableString(row.type_line) ||
      !isStringArrayOrNull(row.color_identity) ||
      !isNullableNumber(row.mana_value) ||
      !hasFiniteNumbers(row, [
        'deck_count',
        'total_eligible_decks',
        'inclusion_rate',
        'average_quantity',
        'top16_deck_count',
        'top16_inclusion_rate',
        'first_place_deck_count',
        'first_place_inclusion_rate',
      ])
    ) {
      throw new Error('The deck comparison response was invalid.');
    }
    return {
      normalizedCardKey: row.normalized_card_key,
      oracleId: row.oracle_id ?? undefined,
      cardName: row.card_name,
      typeLine: row.type_line ?? undefined,
      colorIdentity: row.color_identity ?? [],
      manaValue: row.mana_value === null ? undefined : Number(row.mana_value),
      deckCount: Number(row.deck_count),
      totalEligibleDecks: Number(row.total_eligible_decks),
      inclusionRate: Number(row.inclusion_rate),
      averageQuantity: Number(row.average_quantity),
      top16DeckCount: Number(row.top16_deck_count),
      top16InclusionRate: Number(row.top16_inclusion_rate),
      firstPlaceDeckCount: Number(row.first_place_deck_count),
      firstPlaceInclusionRate: Number(row.first_place_inclusion_rate),
    };
  });
}

export function parseCardInclusionHistoryRows(value: unknown): CardInclusionHistoryPoint[] {
  if (!Array.isArray(value)) {
    throw new Error('The card inclusion history response was invalid.');
  }
  return value.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.period_start !== 'string' ||
      !hasFiniteNumbers(row, [
        'deck_count',
        'total_eligible_decks',
        'event_count',
        'card_event_count',
        'inclusion_rate',
        'event_inclusion_rate',
      ])
    ) {
      throw new Error('The card inclusion history response was invalid.');
    }
    return {
      periodStart: row.period_start,
      deckCount: Number(row.deck_count),
      totalEligibleDecks: Number(row.total_eligible_decks),
      eventCount: Number(row.event_count),
      cardEventCount: Number(row.card_event_count),
      inclusionRate: Number(row.inclusion_rate),
      eventInclusionRate: Number(row.event_inclusion_rate),
    };
  });
}

interface CommanderColorTarget {
  commanderName: string;
  colorIdentity: string[];
  imageUrls?: string[];
}

/**
 * Tournament ingestion stores provider facts. Missing display details are
 * resolved lazily from Scryfall and cached for the current browser session.
 */
async function enrichCommanderColorIdentities(items: CommanderColorTarget[]): Promise<void> {
  const lookupNames = items
    .filter((item) => isRegisteredCommanderName(item.commanderName))
    .flatMap((item) => getCommanderLookupNames(item.commanderName));
  await enrichCommanderCachesFromCanonicalAliases(lookupNames);
  const missingNames = lookupNames.filter((name) => {
    const key = name.toLowerCase();
    return !commanderColorCache.has(key) || !commanderImageCache.has(key);
  });

  if (missingNames.length > 0) {
    try {
      const cards = await getCardsByExactNames(missingNames);
      const resolved = mapColorIdentityByCardName(cards);
      for (const card of cards) {
        const imageUrl = card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop;
        if (imageUrl) commanderImageCache.set(card.name.toLowerCase(), imageUrl);
      }
      for (const name of missingNames) {
        commanderColorCache.set(name.toLowerCase(), resolved.get(name.toLowerCase()) ?? []);
      }
    } catch (error) {
      // Tournament pages should remain usable if Scryfall is temporarily down.
      console.warn('Unable to resolve tournament Commander colors.', error);
    }
  }

  for (const item of items) {
    if (item.colorIdentity.length === 0) {
      item.colorIdentity = getCommanderColorIdentity(item.commanderName, commanderColorCache);
    }
    const names = getCommanderLookupNames(item.commanderName);
    const printingIds = names.map((name) => commanderPrintingCache.get(name.toLowerCase()));
    const isDoubleFacedCard =
      names.length === 2 && Boolean(printingIds[0]) && printingIds[0] === printingIds[1];

    if (isDoubleFacedCard) {
      const printingId = printingIds[0]!;
      item.imageUrls = [commanderArtUrl(printingId, 'front'), commanderArtUrl(printingId, 'back')];
    } else {
      item.imageUrls = names
        .map((name) => commanderImageCache.get(name.toLowerCase()))
        .filter((url): url is string => Boolean(url));
    }
  }
}

/**
 * Tournament providers sometimes retain an older or alternate card name that
 * Scryfall no longer accepts (for example, "Will the Wise"). The canonical
 * alias table already knows those identities, so consult it before making any
 * display-only Scryfall request.
 */
async function enrichCommanderCachesFromCanonicalAliases(names: string[]): Promise<void> {
  if (!supabase) return;
  const unresolvedKeys = [...new Set(names.map((name) => name.trim().toLowerCase()))].filter(
    (key) => !commanderColorCache.has(key) || !commanderImageCache.has(key),
  );
  if (!unresolvedKeys.length) return;

  try {
    const { data, error } = await supabase
      .from('canonical_card_aliases')
      .select(
        `
        normalized_card_key,
        canonical_cards!inner(scryfall_id, color_identity)
      `,
      )
      .in('normalized_card_key', unresolvedKeys);
    if (error) return;

    for (const row of data ?? []) {
      if (!isRecord(row) || typeof row.normalized_card_key !== 'string') {
        continue;
      }
      const relation = Array.isArray(row.canonical_cards)
        ? row.canonical_cards[0]
        : row.canonical_cards;
      if (!isRecord(relation)) continue;
      const colors = relation.color_identity;
      if (isStringArrayOrNull(colors)) {
        commanderColorCache.set(row.normalized_card_key, colors ?? []);
      }
      if (typeof relation.scryfall_id === 'string') {
        commanderPrintingCache.set(row.normalized_card_key, relation.scryfall_id);
        commanderImageCache.set(row.normalized_card_key, commanderArtUrl(relation.scryfall_id));
      }
    }
  } catch {
    // Older deployments may not have canonical aliases yet. Scryfall remains
    // the fallback and the metagame page can still render without an image.
  }
}

function commanderArtUrl(scryfallId: string, face?: 'front' | 'back'): string {
  const faceQuery = face ? `&face=${face}` : '';
  return `https://api.scryfall.com/cards/${encodeURIComponent(
    scryfallId,
  )}?format=image&version=art_crop${faceQuery}`;
}

function mapNormalizedDecklist(deck: NormalizedTournamentDeck): TournamentEntryDecklist {
  const mapCard = (
    card: NormalizedTournamentDeck['cards'][number],
  ): TournamentEntryDecklist['cards'][number] => ({
    name: card.cardName,
    quantity: card.quantity,
    oracleId: card.oracleId ?? null,
    typeLine: card.typeLine ?? '',
    // Normalized tournament rows do not need mana cost for analysis. Keep the
    // display field empty rather than issuing another request per card.
    manaCost: '',
    manaValue: card.manaValue ?? null,
    colorIdentity: card.colorIdentity,
    imageUrl: card.scryfallId
      ? `https://api.scryfall.com/cards/${encodeURIComponent(card.scryfallId)}?format=image&version=normal`
      : '',
    backImageUrl: '',
  });

  return {
    commanders: deck.cards.filter((card) => card.board === 'commander').map(mapCard),
    cards: deck.cards.filter((card) => card.board === 'mainboard').map(mapCard),
  };
}

async function prepareTournamentDecklist(
  decklist: TournamentEntryDecklist,
): Promise<TournamentEntryDecklist> {
  const commanders = groupTournamentDeckCards(decklist.commanders);
  const cards = groupTournamentDeckCards(decklist.cards);

  try {
    const scryfallCards = await getCardsByExactNames(
      [...commanders, ...cards].map((card) => card.name),
    );
    return {
      commanders: applyScryfallCardDetails(commanders, scryfallCards),
      cards: applyScryfallCardDetails(cards, scryfallCards),
    };
  } catch (error) {
    // Keep provider URLs as a fallback if Scryfall is temporarily unavailable.
    console.warn('Unable to refresh tournament card images.', error);
    return { commanders, cards };
  }
}

function normalizeEntryDecklist(value: unknown): TournamentEntryDecklist | null {
  if (!isRecord(value)) return null;
  const commanders = normalizeTournamentCards(value.commanders);
  const cards = normalizeTournamentCards(value.cards);
  if (!commanders || !cards) return null;
  return { commanders, cards };
}

function normalizeTournamentCards(value: unknown) {
  if (!Array.isArray(value)) return null;
  const cards: TournamentEntryDecklist['cards'] = [];
  for (const card of value) {
    if (!isRecord(card) || typeof card.name !== 'string' || typeof card.imageUrl !== 'string') {
      return null;
    }
    cards.push({
      name: card.name,
      quantity: typeof card.quantity === 'number' && card.quantity > 0 ? card.quantity : 1,
      oracleId: typeof card.oracleId === 'string' ? card.oracleId : null,
      typeLine: typeof card.typeLine === 'string' ? card.typeLine : '',
      manaCost: typeof card.manaCost === 'string' ? card.manaCost : '',
      manaValue: typeof card.manaValue === 'number' ? card.manaValue : null,
      imageUrl: card.imageUrl,
      backImageUrl: typeof card.backImageUrl === 'string' ? card.backImageUrl : undefined,
    });
  }
  return cards;
}

async function readFunctionError(error: unknown): Promise<string> {
  if (isRecord(error) && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (isRecord(body) && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      // Fall through to a stable public error.
    }
  }
  return 'Unable to load this tournament decklist.';
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Tournament data is unavailable because Supabase is not configured.');
  }
}

function normalizeFilters(filters: MetagameFilters) {
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    minimumPlayers: Math.max(0, filters.minimumPlayers ?? 0),
    minimumEntries: Math.max(1, filters.minimumEntries ?? 1),
    topFinishThreshold: Math.max(1, filters.topFinishThreshold ?? 16),
  };
}

interface MetagameRow {
  commander_key: string;
  commander_name: string;
  color_identity: string[];
  entries: number;
  tournaments: number;
  wins: number;
  losses: number;
  draws: number;
  match_win_rate: number;
  top16_finishes: number;
  top_cut_rate: number;
  first_place_finishes: number;
  meta_share: number;
}

interface TournamentRow {
  id: string;
  source: 'edhtop16' | 'topdeck';
  source_tournament_id: string;
  name: string;
  event_date: string | null;
  player_count: number | null;
  source_url?: string;
  imported_at: string;
  source_updated_at?: string;
  entry_count?: number;
  registered_commander_count?: number;
  venue_name?: string;
  city?: string;
  state_region?: string;
  country_code?: string;
  location_precision?: Tournament['locationPrecision'];
  is_online?: boolean;
  region_key?: string;
}

interface EntryRow {
  id: string;
  tournament_id: string;
  source_entry_id?: string;
  player_name?: string;
  player_external_id?: string;
  commander_name: string;
  commander_key: string;
  color_identity?: string[];
  standing?: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate?: number;
  decklist_url?: string;
  created_at: string;
  updated_at: string;
  tournaments?: TournamentRow;
  // PostgREST may infer the unique relation as one object; older schemas can
  // still return an array, so the mapper accepts both shapes.
  tournament_decks?: { id: string } | Array<{ id: string }>;
}

function mapMetagameRow(row: MetagameRow): CommanderMetagameStats {
  return {
    commanderKey: row.commander_key,
    commanderName: row.commander_name,
    colorIdentity: row.color_identity ?? [],
    entries: Number(row.entries),
    tournaments: Number(row.tournaments),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    matchWinRate: Number(row.match_win_rate),
    top16Finishes: Number(row.top16_finishes),
    topCutRate: Number(row.top_cut_rate),
    firstPlaceFinishes: Number(row.first_place_finishes),
    metaShare: Number(row.meta_share),
  };
}

function hasRegisteredCommander(item: CommanderMetagameStats) {
  return isRegisteredCommanderName(item.commanderName);
}

function isRegisteredCommanderName(commanderName: string) {
  const name = commanderName.trim().toLowerCase();
  return name !== '' && name !== 'unknown commander';
}

function mapTournamentRow(row: TournamentRow): Tournament {
  return {
    id: row.id,
    source: row.source,
    sourceTournamentId: row.source_tournament_id,
    name: row.name,
    date: row.event_date,
    playerCount: row.player_count,
    url: row.source_url,
    importedAt: row.imported_at,
    sourceUpdatedAt: row.source_updated_at,
    entryCount: Number(row.entry_count ?? 0),
    registeredCommanderCount: Number(row.registered_commander_count ?? 0),
    commanderRegistrationRate:
      Number(row.entry_count ?? 0) > 0
        ? Number(row.registered_commander_count ?? 0) / Number(row.entry_count)
        : 0,
    venueName: row.venue_name,
    city: row.city,
    stateRegion: row.state_region,
    countryCode: row.country_code,
    locationPrecision: row.location_precision,
    isOnline: row.is_online ?? false,
    regionKey: row.region_key ?? 'unknown',
  };
}

function mapEntryRow(row: EntryRow): TournamentEntry {
  const normalizedDeck = Array.isArray(row.tournament_decks)
    ? row.tournament_decks[0]
    : row.tournament_decks;
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    sourceEntryId: row.source_entry_id,
    playerName: row.player_name,
    playerExternalId: row.player_external_id,
    commanderName: row.commander_name,
    commanderKey: row.commander_key,
    colorIdentity: row.color_identity ?? [],
    standing: row.standing,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: row.win_rate ?? null,
    decklistUrl: row.decklist_url,
    tournamentName: row.tournaments?.name,
    tournamentDate: row.tournaments?.event_date ?? undefined,
    tournamentUrl: row.tournaments?.source_url,
    source: row.tournaments?.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tournamentDeckId: normalizedDeck?.id,
  };
}

function friendlyError(operation: string, error: unknown) {
  console.warn(`Tournament repository could not ${operation}.`, error);
  return new Error(`Unable to ${operation}. Please try again later.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface RegionalRow {
  region_key: string;
  tournaments: number;
  entries: number;
  unique_commanders: number;
  top_commander: string | null;
  top_commander_entries: number;
  average_tournament_size: number | null;
}

interface TournamentDeckRow {
  id: string;
  tournament_entry_id: string;
  source: 'topdeck' | 'edhtop16';
  source_deck_id?: string;
  commander_key: string;
  commander_name: string;
  mainboard_card_count?: number;
  sideboard_card_count?: number;
  parsing_status: NormalizedTournamentDeck['parsingStatus'];
  parsing_issues?: Array<{ code: string; message: string }>;
  raw_decklist_available: boolean;
  structured_deck_available: boolean;
  imported_at: string;
  updated_at: string;
  tournament_deck_cards?: Array<{
    id: string;
    board: NormalizedTournamentDeck['cards'][number]['board'];
    canonical_card_id?: string;
    canonical_cards?: CanonicalCardRow | CanonicalCardRow[];
    // Legacy fields remain optional during the rolling schema transition.
    oracle_id?: string;
    scryfall_id?: string;
    normalized_card_key?: string;
    card_name?: string;
    quantity: number;
    type_line?: string;
    color_identity?: string[];
    colors?: string[];
    mana_value?: number;
    is_basic_land: boolean;
    created_at?: string;
    updated_at?: string;
  }>;
  tournament_entries: EntryRow & { tournaments: TournamentRow };
}

interface CanonicalCardRow {
  id: string;
  oracle_id?: string;
  scryfall_id?: string;
  normalized_card_key: string;
  card_name: string;
  type_line?: string;
  color_identity?: string[];
  colors?: string[];
  mana_value?: number;
  is_basic_land: boolean;
}

function mapNormalizedTournamentDeck(row: TournamentDeckRow): NormalizedTournamentDeck {
  return {
    id: row.id,
    tournamentEntryId: row.tournament_entry_id,
    source: row.source,
    sourceDeckId: row.source_deck_id,
    commanderKey: row.commander_key,
    commanderName: row.commander_name,
    mainboardCardCount: row.mainboard_card_count,
    sideboardCardCount: row.sideboard_card_count,
    parsingStatus: row.parsing_status,
    parsingIssues: row.parsing_issues ?? [],
    rawDecklistAvailable: row.raw_decklist_available,
    structuredDeckAvailable: row.structured_deck_available,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    cards: (row.tournament_deck_cards ?? []).flatMap((card) => {
      const canonical = Array.isArray(card.canonical_cards)
        ? card.canonical_cards[0]
        : card.canonical_cards;
      const normalizedCardKey = canonical?.normalized_card_key ?? card.normalized_card_key;
      const cardName = canonical?.card_name ?? card.card_name;
      if (!normalizedCardKey || !cardName) return [];
      return [
        {
          id: card.id,
          board: card.board,
          oracleId: canonical?.oracle_id ?? card.oracle_id,
          scryfallId: canonical?.scryfall_id ?? card.scryfall_id,
          normalizedCardKey,
          cardName,
          quantity: card.quantity,
          typeLine: canonical?.type_line ?? card.type_line,
          colorIdentity: canonical?.color_identity ?? card.color_identity ?? [],
          colors: canonical?.colors ?? card.colors ?? [],
          manaValue: canonical?.mana_value ?? card.mana_value,
          isBasicLand: canonical?.is_basic_land ?? card.is_basic_land,
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        },
      ];
    }),
    entry: mapEntryRow(row.tournament_entries),
    tournament: mapTournamentRow(row.tournament_entries.tournaments),
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
  return (
    value === null || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function hasFiniteNumbers(value: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => typeof value[field] === 'number' && Number.isFinite(value[field]));
}
