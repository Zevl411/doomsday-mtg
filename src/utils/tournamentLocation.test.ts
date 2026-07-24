import { describe, expect, it } from 'vitest';

import {
  displayRegionKey,
  displayTournamentLocation,
  sourceAttribution,
} from './tournamentLocation';

import type { Tournament } from '../models/tournament';

describe('tournament location display', () => {
  it('renders event locality without exposing coordinates', () => {
    expect(
      displayTournamentLocation(
        tournament({
          venueName: 'The Keep',
          city: 'Orlando',
          stateRegion: 'FL',
          countryCode: 'US',
        }),
      ),
    ).toBe('The Keep · Orlando, FL · US');
  });

  it('handles online and unknown locations', () => {
    expect(displayTournamentLocation(tournament({ isOnline: true }))).toBe('Online');
    expect(displayTournamentLocation(tournament())).toBe('Unknown location');
    expect(displayRegionKey('country:US/state:FL')).toBe('US · FL');
  });

  it('provides visible provider attribution metadata', () => {
    expect(sourceAttribution('topdeck')).toEqual({
      label: 'Data provided by TopDeck.gg',
      url: 'https://topdeck.gg',
    });
  });
});

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'event',
    source: 'topdeck',
    sourceTournamentId: 'TID',
    name: 'Event',
    date: null,
    playerCount: null,
    importedAt: '2026-01-01',
    isOnline: false,
    regionKey: 'unknown',
    ...overrides,
  };
}
