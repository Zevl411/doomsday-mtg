import type { DeckVisibility } from './deck'

export type DeckDisplayMode = 'grid' | 'list'
export type DeckGrouping = 'name' | 'mana' | 'type' | 'color'
export type DeckSecondaryGrouping = DeckGrouping | 'none'
export type DeckBuilderSearchSide = 'left' | 'right'
export type DeckStatisticsPosition = 'above' | 'below'

/**
 * Card themes store the generated colors instead of regenerating them on every
 * visit. The source card remains presentation metadata and can safely become
 * unavailable without breaking the saved theme.
 */
export interface CardThemePalette {
  background: string
  surface: string
  surfaceBright: string
  surfaceLight: string
  primary: string
  primaryDarken: string
  primaryLighten: string
  secondary: string
  accent: string
  outline: string
}

export interface DefaultAppTheme {
  mode: 'default'
}

export interface CardArtAppTheme {
  mode: 'card'
  cardId: string
  cardName: string
  artUrl: string
  palette: CardThemePalette
}

export type AppThemePreference = DefaultAppTheme | CardArtAppTheme

export interface UserPreferences {
  defaultDeckDisplay: DeckDisplayMode
  defaultPrimaryGrouping: DeckGrouping
  defaultSecondaryGrouping: DeckSecondaryGrouping
  defaultDeckVisibility: DeckVisibility
  defaultCommanderColorFilter: boolean
  deckBuilderSearchSide: DeckBuilderSearchSide
  deckStatisticsPosition: DeckStatisticsPosition
  appTheme: AppThemePreference
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultDeckDisplay: 'grid',
  defaultPrimaryGrouping: 'type',
  defaultSecondaryGrouping: 'name',
  defaultDeckVisibility: 'public',
  defaultCommanderColorFilter: true,
  deckBuilderSearchSide: 'right',
  deckStatisticsPosition: 'above',
  appTheme: { mode: 'default' },
}
