import { createVuetify } from 'vuetify'
import { oracleDarkTheme } from '../theme/oracleTheme'

// Vuetify themes expose shared color names to every Vuetify component.
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'oracleDarkTheme',
    themes: {
      oracleDarkTheme,
    },
  },
})

export default vuetify
