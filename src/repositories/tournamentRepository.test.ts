import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tournamentRepository } from './tournamentRepository'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { rpc },
}))

beforeEach(() => {
  rpc.mockReset()
  tournamentRepository.clearCache()
})

describe('tournamentRepository', () => {
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

  it('maps provider errors to a friendly message', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('private detail') })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(
      tournamentRepository.getCommanderMetagame(),
    ).rejects.toThrow('Unable to load Commander metagame')
  })
})
