import type { ThemeDefinition } from 'vuetify';

export const oracleDarkColors = {
  background: '#0F0D18',
  surface: '#171321',
  'surface-bright': '#21182B',
  'surface-light': '#2A1C31',
  'surface-variant': '#2A1C31',
  primary: '#D7A24A',
  'primary-darken-1': '#B78234',
  'primary-lighten-1': '#F1D39A',
  // Purple supports neutral and additive actions without implying danger.
  secondary: '#9462A0',
  'secondary-darken-1': '#6B4772',
  'secondary-lighten-1': '#BE92C7',
  accent: '#3A183D',
  'accent-lighten-1': '#56305D',
  error: '#B84B4D',
  info: '#607D9B',
  success: '#5F8A65',
  warning: '#D09A3E',
  outline: '#5A4436',
  'placement-gold': '#D4AF37',
  'placement-silver': '#AEB4BD',
  'placement-bronze': '#B87333',
  'placement-top-cut': '#587A9B',
  'on-background': '#F4E6C5',
  'on-surface': '#F4E6C5',
  'on-surface-variant': '#C6B792',
  'on-primary': '#171321',
  'on-secondary': '#FFF4E0',
  'on-accent': '#FFF4E0',
  'on-error': '#FFF5F2',
  'on-info': '#F7FAFF',
  'on-success': '#F4FFF5',
  'on-warning': '#1C1508',
} as const;

export const oracleDarkVariables = {
  'border-color': '#5A4436',
  'border-opacity': 0.36,
  'high-emphasis-opacity': 0.92,
  'medium-emphasis-opacity': 0.72,
  'disabled-opacity': 0.42,
  'idle-opacity': 0.08,
  'hover-opacity': 0.06,
  'focus-opacity': 0.1,
  'selected-opacity': 0.12,
  'activated-opacity': 0.12,
  'pressed-opacity': 0.14,
  'dragged-opacity': 0.1,
  'theme-kbd': '#21182B',
  'theme-on-kbd': '#F4E6C5',
  'theme-code': '#21182B',
  'theme-on-code': '#F1D39A',
} as const;

/** Restrained Oracle chrome keeps colorful Magic card artwork dominant. */
export const oracleDarkTheme: ThemeDefinition = {
  dark: true,
  colors: oracleDarkColors,
  variables: oracleDarkVariables,
};
