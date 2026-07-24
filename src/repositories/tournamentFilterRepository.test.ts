import { beforeEach, describe, expect, it } from 'vitest';

import { tournamentFilterRepository } from './tournamentFilterRepository';

beforeEach(() => localStorage.clear());

describe('tournamentFilterRepository', () => {
  it('round trips valid filter preferences', () => {
    const preferences = {
      sizeRange: 'standard' as const,
      timePeriod: '3-months' as const,
      sortOrder: 'size-desc' as const,
      registeredCommandersOnly: true,
    };

    expect(tournamentFilterRepository.save(preferences)).toBe(true);
    expect(tournamentFilterRepository.load()).toEqual(preferences);
  });

  it('ignores malformed stored preferences', () => {
    localStorage.setItem(
      'doomsday-mtg-tournament-filters',
      JSON.stringify({
        sizeRange: 'anything',
        timePeriod: 'all',
        sortOrder: 'date-desc',
        registeredCommandersOnly: true,
      }),
    );

    expect(tournamentFilterRepository.load()).toBeNull();
  });
});
