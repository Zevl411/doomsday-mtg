import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createEmptyDeck } from '../models/createDeck'
import { createSupabaseDeckRepository } from './supabaseDeckRepository'

function createClient(records: unknown[] = [], error: Error | null = null) {
  const result = { data: records, error }
  const finalEq = vi.fn().mockResolvedValue(result)
  const firstEq = vi.fn(() => ({ eq: finalEq }))
  const select = vi.fn(() => ({ eq: vi.fn().mockResolvedValue(result) }))
  const upsert = vi.fn().mockResolvedValue(result)
  const remove = vi.fn(() => ({ eq: firstEq }))
  return {
    client: {
      from: vi.fn(() => ({ select, upsert, delete: remove })),
    } as unknown as SupabaseClient,
    upsert,
    firstEq,
    finalEq,
  }
}

describe('supabaseDeckRepository', () => {
  it('requires an authenticated user', () => {
    const { client } = createClient()
    expect(() => createSupabaseDeckRepository(client, '')).toThrow('Sign in')
  })

  it('loads only valid records owned by the active user', async () => {
    const deck = createEmptyDeck('Cloud')
    const { client } = createClient([
      { id: 'row', user_id: 'user-a', deck_id: deck.id, deck_data: deck },
      { id: 'other', user_id: 'user-b', deck_id: deck.id, deck_data: deck },
      { id: 'bad', user_id: 'user-a', deck_id: 'wrong', deck_data: deck },
    ])
    await expect(
      createSupabaseDeckRepository(client, 'user-a').loadDecks(),
    ).resolves.toEqual([deck])
  })

  it('upserts by the user and application deck ID', async () => {
    const deck = createEmptyDeck('Cloud')
    const { client, upsert } = createClient()
    await createSupabaseDeckRepository(client, 'user-a').saveDeck(deck)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-a',
        deck_id: deck.id,
        deck_data: deck,
      }),
      { onConflict: 'user_id,deck_id' },
    )
  })

  it('scopes deletion to deck and user IDs', async () => {
    const { client, firstEq, finalEq } = createClient()
    await createSupabaseDeckRepository(client, 'user-a').deleteDeck('deck-a')
    expect(firstEq).toHaveBeenCalledWith('deck_id', 'deck-a')
    expect(finalEq).toHaveBeenCalledWith('user_id', 'user-a')
  })

  it('maps provider failures to readable errors', async () => {
    const { client } = createClient([], new Error('private provider detail'))
    await expect(
      createSupabaseDeckRepository(client, 'user-a').loadDecks(),
    ).rejects.toThrow('Cloud deck load failed.')
  })
})
