import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
// Only the WUBRGC glyph subset is loaded; templates use Vue components.
import './mana-symbols.css'
import './style.css'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import router from './router'
import { useDeckStore } from './stores/deck'
import { useAuthStore } from './stores/auth'
import { useDeckSyncStore } from './stores/deckSync'

const pinia = createPinia()

// Guests restore one browser draft; signed-in users load their Supabase decks.
const deckStore = useDeckStore(pinia)
const authStore = useAuthStore(pinia)
const syncStore = useDeckSyncStore(pinia)

// Auth changes select either the guest draft or the authenticated cloud library.
await authStore.initialize()
await syncStore.handleUser(authStore.user?.id ?? null)

let previousUserId = authStore.user?.id ?? null
authStore.$subscribe((_mutation, state) => {
  const currentUserId = state.user?.id ?? null
  if (currentUserId !== previousUserId) {
    previousUserId = currentUserId
    void syncStore.handleUser(currentUserId)
  }
})

let previousLibrary = JSON.stringify(deckStore.library)
deckStore.$subscribe((_mutation, state) => {
  const currentLibrary = JSON.stringify(state.library)
  if (currentLibrary !== previousLibrary) {
    previousLibrary = currentLibrary
    if (syncStore.userId && syncStore.syncStatus !== 'syncing') {
      syncStore.hasUnsyncedChanges = true
      void syncStore.syncNow()
    }
  }
})

createApp(App).use(pinia).use(router).use(vuetify).mount('#app')
