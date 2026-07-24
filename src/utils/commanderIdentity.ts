import { getCompactCardName } from './cardName';

export interface CommanderIdentity {
  displayName: string;
  key: string;
  commanders: string[];
}

// Provider feeds use several separators for unordered partner pairs.
const pairSeparator = /\s*(?:\/\/|\/|&|\+|\bwith\b|\band\b)\s*/i;

/** Builds a stable grouping key while retaining a readable provider name. */
export function normalizeCommanderIdentity(name: string): CommanderIdentity {
  const displayName = name.replace(/\s+/g, ' ').trim();
  const commanders = displayName
    .split(pairSeparator)
    .map((commander) => commander.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Partner order has no metagame meaning, so pairs share one sorted key.
  const normalized = commanders
    .map((commander) => commander.toLocaleLowerCase())
    .sort((left, right) => left.localeCompare(right));

  return {
    displayName,
    commanders,
    key: normalized.join(' // '),
  };
}

/**
 * Partner pairs use compact first-name labels in crowded UI, while a lone
 * Commander's full name remains intact.
 */
export function getCompactCommanderDisplayName(name: string): string {
  const identity = normalizeCommanderIdentity(name);
  if (identity.commanders.length < 2) return identity.displayName;

  return identity.commanders.map(getCompactCardName).join('/');
}
