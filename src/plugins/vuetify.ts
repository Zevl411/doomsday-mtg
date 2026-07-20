import { createVuetify } from 'vuetify'
import { oracleDarkTheme } from '../theme/oracleTheme'

/**
 * Shared component defaults are the visual-density boundary for the app.
 * Features should only override these when a workflow genuinely needs a
 * larger control instead of rebuilding the visual system locally.
 */
export const oracleComponentDefaults = {
  VAlert: {
    density: 'compact',
    rounded: 'sm',
  },
  VAutocomplete: {
    color: 'primary',
    density: 'compact',
    variant: 'outlined',
  },
  VBtn: {
    density: 'compact',
    elevation: 0,
    rounded: 'sm',
  },
  VCard: {
    border: true,
    elevation: 0,
    rounded: 'sm',
  },
  VChip: {
    // Chips carry compact metadata, but need more breathing room than controls
    // so symbols, labels, and removable actions remain visually distinct.
    density: 'comfortable',
    rounded: 'md',
  },
  VList: {
    density: 'compact',
  },
  VExpansionPanel: {
    elevation: 0,
    rounded: 'sm',
  },
  VSelect: {
    color: 'primary',
    density: 'compact',
    variant: 'outlined',
  },
  VTable: {
    density: 'compact',
  },
  VTextField: {
    color: 'primary',
    density: 'compact',
    variant: 'outlined',
  },
  VTextarea: {
    color: 'primary',
    density: 'compact',
    variant: 'outlined',
  },
  VSheet: {
    rounded: 'sm',
  },
} as const

// Vuetify themes expose shared color names to every Vuetify component.
const vuetify = createVuetify({
  defaults: oracleComponentDefaults,
  theme: {
    defaultTheme: 'oracleDarkTheme',
    themes: {
      oracleDarkTheme,
    },
  },
})

export default vuetify
