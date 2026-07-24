import type { ScryfallCard } from '../types/card';

/** Splits partner pairs while still accepting a single Commander name. */
export function getCommanderLookupNames(commanderName: string): string[] {
  return commanderName
    .split(/\s*\/\/\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Builds a lookup from every name Scryfall may expose for a card. Card faces
 * matter here because tournament providers sometimes store only one face.
 */
export function mapColorIdentityByCardName(cards: ScryfallCard[]): Map<string, string[]> {
  const identities = new Map<string, string[]>();

  for (const card of cards) {
    const names = [
      card.name,
      card.flavor_name,
      card.printed_name,
      ...(card.card_faces?.flatMap((face) => [face.name, face.printed_name]) ?? []),
    ];

    for (const name of names) {
      if (name) identities.set(normalizeName(name), card.color_identity);
    }
  }

  return identities;
}

/** Combines both Commanders' colors without duplicating color symbols. */
export function getCommanderColorIdentity(
  commanderName: string,
  identities: Map<string, string[]>,
): string[] {
  const colors = getCommanderLookupNames(commanderName).flatMap(
    (name) => identities.get(normalizeName(name)) ?? [],
  );
  return [...new Set(colors)];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
