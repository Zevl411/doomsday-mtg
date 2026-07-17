import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import './style.css'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import router from './views/views'

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')
