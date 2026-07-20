import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseCommanderInclusionRows,
  parseCardInclusionHistoryRows,
  tournamentRepository,
} from './tournamentRepository'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { rpc },
}))

beforeEach(() => {
  rpc.mockReset()
  tournamentRepository.clearCache()
})

describe('tournamentRepository', () => {
  it('validates successful Commander inclusion responses', () => {
    const valid = [{
      normalized_card_key: 'sol-ring',
      oracle_id: null,
      card_name: 'Sol Ring',
      type_line: 'Artifact',
      color_identity: [],
      mana_value: 1,
      deck_count: 8,
      total_eligible_decks: 10,
      inclusion_rate: 0.8,
      average_quantity: 1,
      top16_deck_count: 4,
      top16_inclusion_rate: 0.8,
      first_place_deck_count: 1,
      first_place_inclusion_rate: 1,
    }]
    expect(parseCommanderInclusionRows(valid)[0]).toMatchObject({
      cardName: 'Sol Ring',
      totalEligibleDecks: 10,
    })
    expect(() => parseCommanderInclusionRows([{
      ...valid[0],
      inclusion_rate: 'invalid',
    }])).toThrow('deck comparison response was invalid')
  })

  it('validates card inclusion history responses', () => {
    const valid = [{
      period_start: '2026-07-06',
      deck_count: 3,
      total_eligible_decks: 5,
      event_count: 2,
      card_event_count: 2,
      inclusion_rate: 0.6,
      event_inclusion_rate: 1,
    }]
    expect(parseCardInclusionHistoryRows(valid)[0]).toEqual({
      periodStart: '2026-07-06',
      deckCount: 3,
      totalEligibleDecks: 5,
      eventCount: 2,
      cardEventCount: 2,
      inclusionRate: 0.6,
      eventInclusionRate: 1,
    })
    expect(() => parseCardInclusionHistoryRows([{
      ...valid[0],
      deck_count: 'invalid',
    }])).toThrow('card inclusion history response was invalid')
  })

  it('passes time bucket, card identity, and filters to inclusion history', async () => {
    rpc.mockResolvedValue({ data: [], error: null })

    await tournamentRepository.getCardInclusionOverTime(
      'kinnan',
      { oracleId: 'oracle-id', normalizedCardKey: 'sol-ring' },
      'month',
      {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        minimumPlayers: 16,
        maximumStanding: 16,
        countryCode: 'US',
        stateRegion: 'FL',
        regionKey: 'country:US/state:FL',
        isOnline: false,
      },
    )

    expect(rpc).toHaveBeenCalledWith(
      'get_commander_card_inclusion_over_time',
      {
        target_commander_key: 'kinnan',
        target_oracle_id: 'oracle-id',
        target_normalized_card_key: 'sol-ring',
        time_bucket: 'month',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        minimum_tournament_size: 16,
        country_filter: 'US',
        state_filter: 'FL',
        region_filter: 'country:US/state:FL',
        online_filter: false,
        maximum_standing: 16,
      },
    )
  })

  it('maps normalized filters and database rows', async () => {
    rpc.mockResolvedValue({
      data: [{
        commander_key: 'kinnan',
        commander_name: 'Kinnan',
        color_identity: ['G', 'U'],
        entries: 10,
        tournaments: 4,
        wins: 20,
        losses: 10,
        draws: 2,
        match_win_rate: 0.625,
        top16_finishes: 5,
        top_cut_rate: 0.5,
        first_place_finishes: 1,
        meta_share: 0.2,
      }],
      error: null,
    })

    const result = await tournamentRepository.getCommanderMetagame({
      startDate: '2026-01-01',
      minimumPlayers: 32,
      minimumEntries: 3,
    })

    expect(rpc).toHaveBeenCalledWith('get_commander_metagame', {
      start_date: '2026-01-01',
      end_date: null,
      minimum_players: 32,
      minimum_entries: 3,
      top_finish_threshold: 16,
      country_filter: null,
      state_filter: null,
      region_filter: null,
      online_filter: null,
    })
    expect(result[0]).toMatchObject({
      commanderKey: 'kinnan',
      entries: 10,
      matchWinRate: 0.625,
    })
  })

  it('caches identical aggregate requests', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await tournamentRepository.getCommanderMetagame()
    await tournamentRepository.getCommanderMetagame()
    expect(rpc).toHaveBeenCalledOnce()
  })

  it('omits unresolved Commander placeholders from metagame lists', async () => {
    rpc.mockResolvedValue({
      data: [{
        commander_key: 'unknown-commander',
        commander_name: 'Unknown Commander',
        color_identity: [],
        entries: 50,
        tournaments: 10,
        wins: 0,
        losses: 0,
        draws: 0,
        match_win_rate: 0,
        top16_finishes: 0,
        top_cut_rate: 0,
        first_place_finishes: 0,
        meta_share: 0.5,
      }],
      error: null,
    })

    await expect(tournamentRepository.getCommanderMetagame()).resolves.toEqual([])
  })

  it('maps provider errors to a friendly message', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('private detail') })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(
      tournamentRepository.getCommanderMetagame(),
    ).rejects.toThrow('Unable to load Commander metagame')
  })
})
