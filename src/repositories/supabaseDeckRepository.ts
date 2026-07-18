import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deck } from '../models/deck'
import type { CloudDeckRecord } from '../types/cloudDeck'
import { isUsableDeck } from '../utils/deckStorage'

export interface SupabaseDeckRepository {
  loadDecks(): Promise<Deck[]>
  loadDeck(deckId: string): Promise<Deck | null>
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
        return [hydrateDeck(record)]
      })
    },

    async loadDeck(deckId) {
      const { data, error } = await client
        .from('decks')
        .select('*')
        .eq('deck_id', deckId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw repositoryError('load', error)
      if (!data) return null

      const record = data as CloudDeckRecord
      if (
        record.user_id !== userId ||
        record.deck_id !== record.deck_data?.id ||
        !isUsableDeck(record.deck_data)
      ) {
        console.warn('An invalid cloud deck record was ignored.', record.id)
        return null
      }
      return hydrateDeck(record)
    },

    async saveDeck(deck) {
      const { error } = await client.from('decks').upsert(
        {
          user_id: userId,
          deck_id: deck.id,
          name: deck.name,
          description: deck.description ?? '',
          visibility: deck.visibility ?? 'private',
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

function hydrateDeck(record: CloudDeckRecord): Deck {
  return {
    ...record.deck_data,
    name: record.name ?? record.deck_data.name,
    description: record.description ?? record.deck_data.description ?? '',
    visibility: record.visibility ?? record.deck_data.visibility ?? 'private',
    creatorUsername:
      record.creator_username || record.deck_data.creatorUsername || 'Unknown',
  }
}

function repositoryError(operation: string, error: unknown): Error {
  console.warn(`Supabase deck ${operation} failed.`, error)
  return new Error(`Cloud deck ${operation} failed.`)
}
