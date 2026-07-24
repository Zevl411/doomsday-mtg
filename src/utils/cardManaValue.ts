import type { ScryfallCard } from '../types/card';

/**
 * Prefer Scryfall's mana value, then derive it from every available casting
 * cost. The fallback keeps older saved decks useful after their `cmc` field
 * was previously omitted during storage normalization.
 */
export function getCardManaValue(card: ScryfallCard): number {
  if (typeof card.cmc === 'number' && Number.isFinite(card.cmc) && card.cmc >= 0) {
    return card.cmc;
  }

  const costs = card.mana_cost
    ? [card.mana_cost]
    : (card.card_faces ?? [])
        .map((face) => face.mana_cost)
        .filter((cost): cost is string => Boolean(cost));

  return costs.reduce((total, cost) => total + getManaCostValue(cost), 0);
}

function getManaCostValue(manaCost: string): number {
  const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];

  return symbols.reduce((total, wrappedSymbol) => {
    const symbol = wrappedSymbol.slice(1, -1).toUpperCase();
    const numericValue = Number(symbol);
    if (Number.isFinite(numericValue)) return total + numericValue;

    // X, Y, and Z contribute zero outside the stack. A two-brid symbol has
    // mana value 2; other hybrid and Phyrexian symbols have mana value 1.
    if (['X', 'Y', 'Z'].includes(symbol)) return total;
    if (symbol.startsWith('2/')) return total + 2;
    if (symbol === '½') return total + 0.5;
    return total + 1;
  }, 0);
}
