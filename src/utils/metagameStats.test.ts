import { describe, expect, it } from 'vitest';

import { calculateMetagameStats } from './metagameStats';

describe('calculateMetagameStats', () => {
  it('calculates share, match rate, finishes, and distinct tournaments', () => {
    const stats = calculateMetagameStats([
      {
        tournamentId: 'one',
        commanderKey: 'kinnan',
        commanderName: 'Kinnan',
        colorIdentity: ['G', 'U'],
        wins: 3,
        losses: 1,
        draws: 0,
        standing: 1,
      },
      {
        tournamentId: 'two',
        commanderKey: 'kinnan',
        commanderName: 'Kinnan',
        colorIdentity: ['G', 'U'],
        wins: 1,
        losses: 1,
        draws: 2,
        standing: 20,
      },
      {
        tournamentId: 'one',
        commanderKey: 'rogsi',
        commanderName: 'Rograkh // Silas',
        colorIdentity: ['U', 'B', 'R'],
        wins: 0,
        losses: 0,
        draws: 0,
        standing: 16,
      },
    ]);

    expect(stats[0]).toMatchObject({
      entries: 2,
      tournaments: 2,
      matchWinRate: 0.5,
      top16Finishes: 1,
      topCutRate: 0.5,
      firstPlaceFinishes: 1,
      metaShare: 2 / 3,
    });
    expect(stats[1]?.matchWinRate).toBe(0);
  });
});
