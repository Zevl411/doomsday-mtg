import { createVuetify } from 'vuetify'
import { oracleDarkTheme } from '../theme/oracleTheme'

// Vuetify themes expose shared color names to every Vuetify component.
const vuetify = createVuetify({
  defaults: {
    VBtn: {
      rounded: 'lg',
    },
    VSelect: {
      color: 'primary',
      variant: 'outlined',
    },
    VTextField: {
      color: 'primary',
      variant: 'outlined',
    },
    VTextarea: {
      color: 'primary',
      variant: 'outlined',
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
