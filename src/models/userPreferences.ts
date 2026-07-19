import type { DeckVisibility } from './deck'

export type DeckDisplayMode = 'grid' | 'list'
export type DeckGrouping = 'name' | 'mana' | 'type' | 'color'
export type DeckSecondaryGrouping = DeckGrouping | 'none'
export type DeckBuilderSearchSide = 'left' | 'right'
export type DeckStatisticsPosition = 'above' | 'below'

export interface UserPreferences {
  defaultDeckDisplay: DeckDisplayMode
  defaultPrimaryGrouping: DeckGrouping
  defaultSecondaryGrouping: DeckSecondaryGrouping
  defaultDeckVisibility: DeckVisibility
  defaultCommanderColorFilter: boolean
  deckBuilderSearchSide: DeckBuilderSearchSide
  deckStatisticsPosition: DeckStatisticsPosition
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultDeckDisplay: 'grid',
  defaultPrimaryGrouping: 'type',
  defaultSecondaryGrouping: 'name',
  defaultDeckVisibility: 'private',
  defaultCommanderColorFilter: true,
  deckBuilderSearchSide: 'right',
  deckStatisticsPosition: 'above',
}
