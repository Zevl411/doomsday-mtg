import { supabase } from '../lib/supabase';

import { parseCommanderInclusionRows } from './tournamentRepository';

import type { DeckComparisonFilters, TournamentDeckSimilarity } from '../models/deckComparison';
import type { CommanderCardInclusion } from '../models/tournament';

export interface DeckComparisonData {
  inclusion: CommanderCardInclusion[];
  similarities: TournamentDeckSimilarity[];
}

/**
 * Comparison reads public tournament statistics only. The caller supplies a
 * bounded set of analytical keys; no personal Deck ID or private row crosses
 * the Supabase boundary.
 */
export const deckComparisonRepository = {
  async compare(
    commanderKey: string,
    cardKeys: string[],
    filters: DeckComparisonFilters,
  ): Promise<DeckComparisonData> {
    if (!supabase) {
      throw new Error('Deck comparison is unavailable because Supabase is not configured.');
    }

    const aggregatePromise = supabase.rpc('get_deck_comparison_aggregate', {
      p_commander_key: commanderKey,
      p_start_date: filters.startDate ?? null,
      p_end_date: filters.endDate ?? null,
      p_minimum_tournament_size: filters.minimumTournamentSize ?? null,
      p_maximum_standing: filters.maximumStanding ?? null,
      p_country_code: null,
      p_state_region: null,
      p_region_key: null,
      p_is_online: null,
      p_minimum_complete_decks: Math.max(1, filters.minimumCompleteDecks ?? 1),
    });
    const similarityPromise = supabase.rpc('get_similar_tournament_decks', {
      p_commander_key: commanderKey,
      p_card_keys: [...new Set(cardKeys)],
      p_start_date: filters.startDate ?? null,
      p_end_date: filters.endDate ?? null,
      p_minimum_tournament_size: filters.minimumTournamentSize ?? null,
      p_maximum_standing: filters.maximumStanding ?? null,
      p_country_code: null,
      p_state_region: null,
      p_region_key: null,
      p_is_online: null,
      p_minimum_complete_decks: Math.max(1, filters.minimumCompleteDecks ?? 1),
      p_similarity_limit: 20,
    });

    const [aggregateResult, similarityResult] = await Promise.all([
      aggregatePromise,
      similarityPromise,
    ]);
    if (aggregateResult.error) {
      console.warn('Deck comparison aggregate request failed.', aggregateResult.error);
      throw new Error('Unable to load the Deck comparison sample.');
    }
    if (similarityResult.error) {
      console.warn('Tournament similarity request failed.', similarityResult.error);
      throw new Error('Unable to compare similar tournament Decks.');
    }

    return {
      inclusion: parseCommanderInclusionRows(aggregateResult.data),
      similarities: parseTournamentSimilarityRows(similarityResult.data),
    };
  },
};

/** Validates the successful RPC payload before it reaches comparison views. */
export function parseTournamentSimilarityRows(value: unknown): TournamentDeckSimilarity[] {
  if (!Array.isArray(value)) {
    throw new Error('The tournament similarity response was invalid.');
  }

  return value.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.tournament_deck_id !== 'string' ||
      typeof row.tournament_name !== 'string' ||
      !isNullableString(row.pilot_name) ||
      !isNullableNumber(row.standing) ||
      !isNullableString(row.event_date) ||
      !isNullableString(row.region_key) ||
      typeof row.shared_card_count !== 'number' ||
      typeof row.union_card_count !== 'number' ||
      typeof row.similarity_rate !== 'number' ||
      (row.source !== 'topdeck' && row.source !== 'edhtop16') ||
      !isNullableString(row.source_url)
    ) {
      throw new Error('The tournament similarity response was invalid.');
    }

    return {
      tournamentDeckId: row.tournament_deck_id,
      tournamentName: row.tournament_name,
      pilotName: row.pilot_name ?? undefined,
      standing: row.standing ?? undefined,
      eventDate: row.event_date ?? undefined,
      regionKey: row.region_key ?? undefined,
      sharedCardCount: row.shared_card_count,
      unionCardCount: row.union_card_count,
      similarityRate: row.similarity_rate,
      source: row.source,
      sourceUrl: row.source_url ?? undefined,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}
