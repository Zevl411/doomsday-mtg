import type { DeckCard } from '../models/deck';
import type { PriceCurrency } from '../models/userPreferences';
import type { ScryfallCard, ScryfallCardPrices } from '../types/card';

export type CardPriceFinish = 'Regular' | 'Foil' | 'Etched';

export interface CardMarketPrice {
  finish: CardPriceFinish;
  amount: number;
}

const PRICE_FIELDS: Array<{
  field: keyof ScryfallCardPrices;
  finish: CardPriceFinish;
}> = [
  { field: 'usd', finish: 'Regular' },
  { field: 'usd_foil', finish: 'Foil' },
  { field: 'usd_etched', finish: 'Etched' },
];

/** Converts only valid upstream numeric strings into displayable prices. */
export function getCardMarketPrices(card: ScryfallCard): CardMarketPrice[] {
  return PRICE_FIELDS.flatMap(({ field, finish }) => {
    const rawPrice = card.prices?.[field];
    if (typeof rawPrice !== 'string' || rawPrice.trim() === '') return [];
    const amount = Number(rawPrice);
    return Number.isFinite(amount) && amount >= 0 ? [{ finish, amount }] : [];
  });
}

/** Returns the market value matching the finish selected for one Deck entry. */
export function getSelectedCardPrice(card: ScryfallCard, foil = false): number | null {
  const finish = foil ? 'Foil' : 'Regular';
  return getCardMarketPrices(card).find((price) => price.finish === finish)?.amount ?? null;
}

/** Quantity-aware entry totals keep row, group, and Deck totals consistent. */
export function getDeckEntryPrice(
  entry: DeckCard,
  pricingCard: ScryfallCard = entry.card,
): number | null {
  const unitPrice = getSelectedCardPrice(pricingCard, entry.foil === true);
  return unitPrice === null ? null : unitPrice * entry.quantity;
}

export function sumKnownDeckEntryPrices(
  entries: DeckCard[],
  resolveCard: (card: ScryfallCard) => ScryfallCard = (card) => card,
): number | null {
  let total = 0;
  let knownEntryCount = 0;
  for (const entry of entries) {
    const price = getDeckEntryPrice(entry, resolveCard(entry.card));
    if (price === null) continue;
    total += price;
    knownEntryCount += 1;
  }
  return knownEntryCount > 0 ? total : null;
}

export function formatCardPrice(amount: number, currency: PriceCurrency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Allows only the marketplace host supplied by Scryfall into an href. */
export function getTcgplayerPurchaseUrl(card: ScryfallCard): string | null {
  const value = card.purchase_uris?.tcgplayer;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'tcgplayer.com' || url.hostname.endsWith('.tcgplayer.com'))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
