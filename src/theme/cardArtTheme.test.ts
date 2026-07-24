import { describe, expect, it } from 'vitest';

import {
  buildCardThemePalette,
  buildCardArtProxyUrl,
  getVuetifyTheme,
  normalizeAppTheme,
} from './cardArtTheme';

import type { CardThemePalette } from '../models/userPreferences';

const palette: CardThemePalette = {
  background: '#101018',
  surface: '#181826',
  surfaceBright: '#242438',
  surfaceLight: '#30304A',
  primary: '#D08040',
  primaryDarken: '#94582D',
  primaryLighten: '#EAB989',
  secondary: '#5080C0',
  accent: '#283C62',
  outline: '#826052',
};

describe('card artwork themes', () => {
  it('routes artwork sampling through the configured Edge Function', () => {
    expect(
      buildCardArtProxyUrl(
        'https://cards.scryfall.io/art_crop/front/a/b/card.jpg?123',
        'https://example.supabase.co/',
      ),
    ).toBe(
      'https://example.supabase.co/functions/v1/card-art-proxy?url=' +
        'https%3A%2F%2Fcards.scryfall.io%2Fart_crop%2Ffront%2Fa%2Fb%2Fcard.jpg%3F123',
    );
  });

  it('explains when the proxy is not configured', () => {
    expect(() => buildCardArtProxyUrl('art.jpg', undefined)).toThrow(
      'Card artwork themes require the Supabase card-art proxy',
    );
  });

  it('creates a complete dark palette from repeated artwork colors', () => {
    const result = buildCardThemePalette([
      ...Array.from({ length: 20 }, () => ({
        red: 190,
        green: 70,
        blue: 35,
      })),
      ...Array.from({ length: 12 }, () => ({
        red: 45,
        green: 105,
        blue: 190,
      })),
    ]);

    for (const color of Object.values(result)) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(result.background).not.toBe(result.primary);
    expect(result.primary).not.toBe(result.secondary);
  });

  it('retains distinct color regions instead of tinting every role alike', () => {
    const result = buildCardThemePalette([
      ...Array.from({ length: 120 }, () => ({
        red: 220,
        green: 45,
        blue: 35,
      })),
      ...Array.from({ length: 45 }, () => ({
        red: 35,
        green: 65,
        blue: 220,
      })),
      ...Array.from({ length: 25 }, () => ({
        red: 35,
        green: 190,
        blue: 75,
      })),
    ]);

    expect(dominantChannel(result.primary)).toBe('red');
    expect(dominantChannel(result.secondary)).toBe('blue');
    expect(dominantChannel(result.accent)).toBe('green');
  });

  it('rejects incomplete stored palettes at the persistence boundary', () => {
    expect(
      normalizeAppTheme({
        mode: 'card',
        cardId: 'card-id',
        cardName: 'Card',
        artUrl: 'art.jpg',
        palette: { primary: '#FFFFFF' },
      }),
    ).toEqual({ mode: 'default' });
  });

  it('restores a valid card theme and normalizes hex casing', () => {
    expect(
      normalizeAppTheme({
        mode: 'card',
        cardId: 'card-id',
        cardName: 'Card',
        artUrl: 'art.jpg',
        palette: {
          ...palette,
          primary: '#d08040',
        },
      }),
    ).toEqual({
      mode: 'card',
      cardId: 'card-id',
      cardName: 'Card',
      artUrl: 'art.jpg',
      palette: {
        ...palette,
        primary: '#D08040',
      },
    });
  });

  it('maps generated colors while preserving semantic status colors', () => {
    const result = getVuetifyTheme({
      mode: 'card',
      cardId: 'card-id',
      cardName: 'Card',
      artUrl: 'art.jpg',
      palette,
    });

    expect(result.dark).toBe(true);
    expect(result.colors.primary).toBe(palette.primary);
    expect(result.colors.background).toBe(palette.background);
    expect(result.colors.error).toBe('#B84B4D');
    expect(result.colors['on-primary']).toMatch(/^#[0-9A-F]{6}$/);
    expect(result.colors['on-secondary']).toMatch(/^#[0-9A-F]{6}$/);
    expect(result.colors['on-accent']).toMatch(/^#[0-9A-F]{6}$/);
  });
});

function dominantChannel(value: string): 'red' | 'green' | 'blue' {
  const channels = {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  };
  return (Object.entries(channels) as Array<['red' | 'green' | 'blue', number]>).sort(
    (left, right) => right[1] - left[1],
  )[0][0];
}
