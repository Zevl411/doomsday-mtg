import { supabase } from '../lib/supabase';
import { isUsableDeck } from '../utils/deckStorage';

import type { Deck } from '../models/deck';
import type { CloudDeckRecord } from '../types/cloudDeck';

function toDeck(record: CloudDeckRecord): Deck | null {
  if (!isUsableDeck(record.deck_data)) return null;
  return {
    ...record.deck_data,
    name: record.name ?? record.deck_data.name,
    description: record.description ?? record.deck_data.description ?? '',
    visibility: record.visibility ?? record.deck_data.visibility ?? 'private',
    creatorUsername: record.creator_username || record.deck_data.creatorUsername || 'Unknown',
  };
}

export const sharedDeckRepository = {
  async listPublic(): Promise<Deck[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .eq('visibility', 'public')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw new Error('Public decks could not be loaded.');
    return ((data ?? []) as CloudDeckRecord[])
      .map(toDeck)
      .filter((deck): deck is Deck => Boolean(deck));
  },

  async getAccessible(deckId: string): Promise<Deck | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .eq('deck_id', deckId)
      .maybeSingle();
    if (error) throw new Error('This deck could not be loaded.');
    return data ? toDeck(data as CloudDeckRecord) : null;
  },
};
