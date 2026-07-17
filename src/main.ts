import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import './style.css'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import router from './router'
import { useDeckStore } from './stores/deck'

const pinia = createPinia()

// Creating the store at startup restores any valid locally saved deck.
useDeckStore(pinia)

createApp(App).use(pinia).use(router).use(vuetify).mount('#app')
