import { getDeckCommanders } from './commanderPairing';

import type { Deck } from '../models/deck';

const COMMANDER_DECK_SIZE = 100;

export interface DeckSizeStatus {
  total: number;
  target: number;
  remaining: number;
  complete: boolean;
  overLimit: boolean;
  message: string;
}

export function getMainDeckCardCount(deck: Deck): number {
  // reduce() combines all entry quantities into one total, starting from zero.
  return deck.cards.reduce((total, deckCard) => total + deckCard.quantity, 0);
}

export function getTotalDeckCardCount(deck: Deck): number {
  const commanderCount = getDeckCommanders(deck).length;
  return getMainDeckCardCount(deck) + commanderCount;
}

export function getRemainingCardCount(deck: Deck): number {
  return Math.max(COMMANDER_DECK_SIZE - getTotalDeckCardCount(deck), 0);
}

export function getDeckSizeStatus(deck: Deck): DeckSizeStatus {
  const total = getTotalDeckCardCount(deck);
  const remaining = getRemainingCardCount(deck);
  const complete = total === COMMANDER_DECK_SIZE;
  const overLimit = total > COMMANDER_DECK_SIZE;
  const remainingLabel = remaining === 1 ? 'card' : 'cards';

  let message = `${remaining} ${remainingLabel} remaining.`;

  if (complete) {
    message = 'Deck size complete.';
  } else if (overLimit) {
    const excess = total - COMMANDER_DECK_SIZE;
    const excessLabel = excess === 1 ? 'card' : 'cards';
    message = `${excess} ${excessLabel} over the limit.`;
  }

  return {
    total,
    target: COMMANDER_DECK_SIZE,
    remaining,
    complete,
    overLimit,
    message,
  };
}
