import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import './style.css'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import { useDeckStore } from './stores/deck'
import router from './views/views'

const pinia = createPinia()

// Creating the store at startup restores any valid locally saved deck.
useDeckStore(pinia)

createApp(App).use(pinia).use(router).use(vuetify).mount('#app')
