import { supabase } from '../lib/supabase'
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from '../models/userPreferences'
import { normalizeAppTheme } from '../theme/cardArtTheme'

const STORAGE_KEY = 'doomsday-mtg-user-preferences'

export async function loadUserPreferences(
  userId: string | null,
): Promise<UserPreferences> {
  if (userId && supabase) {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (!error && data) return normalizePreferences({
      defaultDeckDisplay: data.default_deck_display,
      defaultPrimaryGrouping: data.default_primary_grouping,
      defaultSecondaryGrouping: data.default_secondary_grouping,
      defaultDeckVisibility: data.default_deck_visibility,
      defaultCommanderColorFilter: data.default_commander_color_filter,
      deckBuilderSearchSide: data.deck_builder_search_side,
      deckStatisticsPosition: data.deck_statistics_position,
      appTheme: data.app_theme,
    })
    if (error) console.warn('Unable to load user preferences.', error)
  }

  try {
    return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
  } catch {
    return { ...DEFAULT_USER_PREFERENCES }
  }
}

export async function saveUserPreferences(
  preferences: UserPreferences,
  userId: string | null,
): Promise<boolean> {
  if (userId && supabase) {
    const { error } = await supabase.from('user_preferences').upsert({
      user_id: userId,
      default_deck_display: preferences.defaultDeckDisplay,
      default_primary_grouping: preferences.defaultPrimaryGrouping,
      default_secondary_grouping: preferences.defaultSecondaryGrouping,
      default_deck_visibility: preferences.defaultDeckVisibility,
      default_commander_color_filter: preferences.defaultCommanderColorFilter,
      deck_builder_search_side: preferences.deckBuilderSearchSide,
      deck_statistics_position: preferences.deckStatisticsPosition,
      app_theme: preferences.appTheme,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.warn('Unable to save user preferences.', error)
      return false
    }
    return true
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    return true
  } catch {
    return false
  }
}

export function normalizePreferences(
  value: Partial<UserPreferences>,
): UserPreferences {
  const defaults = DEFAULT_USER_PREFERENCES
  const grouping = ['name', 'mana', 'type', 'color']
  return {
    defaultDeckDisplay: value.defaultDeckDisplay === 'list' ? 'list' : 'grid',
    defaultPrimaryGrouping: grouping.includes(value.defaultPrimaryGrouping ?? '')
      ? value.defaultPrimaryGrouping!
      : defaults.defaultPrimaryGrouping,
    defaultSecondaryGrouping:
      value.defaultSecondaryGrouping === 'none' ||
      grouping.includes(value.defaultSecondaryGrouping ?? '')
        ? value.defaultSecondaryGrouping!
        : defaults.defaultSecondaryGrouping,
    defaultDeckVisibility:
      ['private', 'unlisted', 'public'].includes(value.defaultDeckVisibility ?? '')
        ? value.defaultDeckVisibility!
        : defaults.defaultDeckVisibility,
    defaultCommanderColorFilter:
      typeof value.defaultCommanderColorFilter === 'boolean'
        ? value.defaultCommanderColorFilter
        : defaults.defaultCommanderColorFilter,
    deckBuilderSearchSide:
      value.deckBuilderSearchSide === 'left' ? 'left' : 'right',
    deckStatisticsPosition:
      value.deckStatisticsPosition === 'below' ? 'below' : 'above',
    appTheme: normalizeAppTheme(value.appTheme),
  }
}
