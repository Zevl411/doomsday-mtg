import { describe, expect, it } from 'vitest';

import { compareDeckToAggregate, getInclusionTier } from './cardInclusion';

import type { CommanderCardInclusion, NormalizedTournamentDeckCard } from '../models/tournament';

describe('card inclusion helpers', () => {
  it('uses centralized descriptive tiers', () => {
    expect(getInclusionTier(0.8)).toBe('Core');
    expect(getInclusionTier(0.5)).toBe('Common');
    expect(getInclusionTier(0.2)).toBe('Flexible');
    expect(getInclusionTier(0.19)).toBe('Rare');
  });

  it('compares mainboard sets with Jaccard overlap', () => {
    const cards = [deckCard('a'), deckCard('c')];
    const aggregate = [inclusion('a', 0.9), inclusion('b', 0.85), inclusion('c', 0.1)];
    const result = compareDeckToAggregate(cards, aggregate);
    expect(result.sharedCardCount).toBe(2);
    expect(result.similarity).toBeCloseTo(2 / 3);
    expect(result.missingCoreCards.map((card) => card.normalizedCardKey)).toEqual(['b']);
    expect(result.rareCards.map((card) => card.normalizedCardKey)).toEqual(['c']);
  });
});

function deckCard(key: string): NormalizedTournamentDeckCard {
  return {
    id: key,
    board: 'mainboard',
    normalizedCardKey: key,
    cardName: key,
    quantity: 1,
    colorIdentity: [],
    colors: [],
    isBasicLand: false,
  };
}

function inclusion(key: string, rate: number): CommanderCardInclusion {
  return {
    normalizedCardKey: key,
    cardName: key,
    colorIdentity: [],
    deckCount: 1,
    totalEligibleDecks: 1,
    inclusionRate: rate,
    averageQuantity: 1,
    top16DeckCount: 1,
    top16InclusionRate: rate,
    firstPlaceDeckCount: 0,
    firstPlaceInclusionRate: 0,
  };
}
