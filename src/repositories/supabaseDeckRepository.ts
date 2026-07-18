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
      const baseRecord = {
        user_id: userId,
        deck_id: deck.id,
        name: deck.name,
        deck_data: deck,
        schema_version: 1,
        created_at: deck.createdAt,
        updated_at: deck.updatedAt,
      }
      const { error } = await client.from('decks').upsert(
        {
          ...baseRecord,
          description: deck.description ?? '',
          visibility: deck.visibility ?? 'private',
        },
        { onConflict: 'user_id,deck_id' },
      )
      if (!error) return

      // Deployments can briefly run newer clients before the sharing migration
      // reaches PostgREST. The full Deck remains safe inside deck_data, so a
      // legacy upsert keeps saves working until the schema cache catches up.
      if (isMissingSharingColumn(error)) {
        const legacyResult = await client.from('decks').upsert(
          baseRecord,
          { onConflict: 'user_id,deck_id' },
        )
        if (!legacyResult.error) return
        throw repositoryError('save', legacyResult.error)
      }
      throw repositoryError('save', error)
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

function isMissingSharingColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: unknown; message?: unknown }
  return (
    value.code === 'PGRST204' &&
    typeof value.message === 'string' &&
    /\b(description|visibility|creator_username)\b/.test(value.message)
  )
}
