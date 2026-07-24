import type { DeckBoard } from '../types/deckImport';

const BOARD_HEADINGS: Record<string, DeckBoard> = {
  commander: 'commander',
  commanders: 'commander',
  'command zone': 'commander',
  commandzone: 'commander',
  deck: 'mainboard',
  main: 'mainboard',
  'main deck': 'mainboard',
  maindeck: 'mainboard',
  mainboard: 'mainboard',
  side: 'sideboard',
  'side deck': 'sideboard',
  sidedeck: 'sideboard',
  sideboard: 'sideboard',
  maybe: 'maybeboard',
  'maybe board': 'maybeboard',
  maybeboard: 'maybeboard',
  consider: 'considering',
  considering: 'considering',
  'considering board': 'considering',
  companion: 'companion',
  companions: 'companion',
  token: 'tokens',
  tokens: 'tokens',
  acquire: 'acquireboard',
  acquireboard: 'acquireboard',
  'acquire board': 'acquireboard',
};

export function normalizeDecklistHeading(line: string): string {
  let heading = line.trim();

  // Remove only balanced, familiar heading wrappers from the whole line.
  const wrappers: Array<[RegExp, string]> = [
    [/^~~(.+)~~$/, '$1'],
    [/^\*\*(.+)\*\*$/, '$1'],
    [/^\[(.+)\]$/, '$1'],
    [/^#{1,6}\s+(.+)$/, '$1'],
    [/^--+\s*(.+?)\s*--+$/, '$1'],
    [/^===+\s*(.+?)\s*===+$/, '$1'],
  ];

  for (const [pattern, replacement] of wrappers) {
    if (pattern.test(heading)) {
      heading = heading.replace(pattern, replacement);
      break;
    }
  }

  return heading.trim().replace(/:$/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getDecklistBoardHeading(line: string): DeckBoard | null {
  return BOARD_HEADINGS[normalizeDecklistHeading(line)] ?? null;
}
