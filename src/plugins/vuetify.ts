import { createVuetify } from 'vuetify'
import {
  aliases as mdiSvgAliases,
  mdi as mdiSvg,
} from 'vuetify/iconsets/mdi-svg'
import { oracleDarkTheme } from '../theme/oracleTheme'

/*
 * Inline SVG icons avoid a hidden dependency on an external icon font. Every
 * Vuetify-owned control and app alias therefore renders in production, tests,
 * and GitHub Pages using the surrounding semantic foreground color.
 */
export const oracleIconAliases = {
  ...mdiSvgAliases,
  refresh:
    'svg:M17.65,6.35C16.2,4.9 14.21,4 12,4C7.58,4 4,7.58 4,12C4,16.42 7.58,20 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18C8.69,18 6,15.31 6,12C6,8.69 8.69,6 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H21V3L17.65,6.35Z',
  dockLeft:
    'svg:M4,4H20V20H4V4M6,6V18H10V6H6M12,6V18H18V6H12Z',
  dockRight:
    'svg:M4,4H20V20H4V4M6,6V18H12V6H6M14,6V18H18V6H14Z',
  imageSize:
    'svg:M3,3H10V5H5V10H3V3M14,3H21V10H19V5H14V3M3,14H5V19H10V21H3V14M19,14H21V21H14V19H19V14M8,8H16V16H8V8Z',
  commander:
    'svg:M12,2C14.21,2 16,3.79 16,6C16,8.21 14.21,10 12,10C9.79,10 8,8.21 8,6C8,3.79 9.79,2 12,2M12,12C16.42,12 20,13.79 20,16V18H13.5L12,21L10.5,18H4V16C4,13.79 7.58,12 12,12M18.5,8L19.3,10.2L21.5,11L19.3,11.8L18.5,14L17.7,11.8L15.5,11L17.7,10.2L18.5,8Z',
} as const

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
  icons: {
    defaultSet: 'mdi',
    aliases: oracleIconAliases,
    sets: {
      mdi: mdiSvg,
    },
  },
  theme: {
    defaultTheme: 'oracleDarkTheme',
    themes: {
      oracleDarkTheme,
    },
  },
})

export default vuetify
