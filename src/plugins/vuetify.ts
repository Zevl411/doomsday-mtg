import { createVuetify } from 'vuetify'

// Vuetify themes expose shared color names to every Vuetify component.
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'doomsdayDark',
    themes: {
      doomsdayDark: {
        dark: true,
        colors: {
          background: '#0d1117',
          surface: '#151b23',
          'surface-bright': '#202936',
          primary: '#6ea8d8',
          secondary: '#c7a96b',
          success: '#5fa777',
          error: '#d66767',
          warning: '#d5a24b',
          info: '#75a7c7',
        },
      },
    },
  },
})

export default vuetify
