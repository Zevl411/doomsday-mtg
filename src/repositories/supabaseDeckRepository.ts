import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deck } from '../models/deck'
import type { CloudDeckRecord } from '../types/cloudDeck'
import { isUsableDeck } from '../utils/deckStorage'

export interface SupabaseDeckRepository {
  loadDecks(): Promise<Deck[]>
  saveDeck(deck: Deck): Promise<void>
  deleteDeck(deckId: string): Promise<void>
}

export function createSupabaseDeckRepository(
  client: SupabaseClient,
  userId: string,
): SupabaseDeckRepository {
  if (!userId) {
    throw new Error('Sign in before accessing cloud decks.')
  }

  return {
    async loadDecks() {
      const { data, error } = await client
        .from('decks')
        .select('*')
        .eq('user_id', userId)
      if (error) throw repositoryError('load', error)

      return ((data ?? []) as CloudDeckRecord[]).flatMap((record) => {
        if (
          record.user_id !== userId ||
          record.deck_id !== record.deck_data?.id ||
          !isUsableDeck(record.deck_data)
        ) {
          console.warn('An invalid cloud deck record was ignored.', record.id)
          return []
        }
        return [record.deck_data]
      })
    },

    async saveDeck(deck) {
      const { error } = await client.from('decks').upsert(
        {
          user_id: userId,
          deck_id: deck.id,
          name: deck.name,
          deck_data: deck,
          schema_version: 1,
          created_at: deck.createdAt,
          updated_at: deck.updatedAt,
        },
        { onConflict: 'user_id,deck_id' },
      )
      if (error) throw repositoryError('save', error)
    },

    async deleteDeck(deckId) {
      const { error } = await client
        .from('decks')
        .delete()
        .eq('deck_id', deckId)
        .eq('user_id', userId)
      if (error) throw repositoryError('delete', error)
    },
  }
}

function repositoryError(operation: string, error: unknown): Error {
  console.warn(`Supabase deck ${operation} failed.`, error)
  return new Error(`Cloud deck ${operation} failed.`)
}
