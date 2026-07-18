<template>
  <v-app>
    <v-app-bar border="b" color="surface" flat height="76">
      <v-container class="d-flex align-center mx-auto px-4 px-sm-6">
        <RouterLink
          :aria-label="`Go to ${appConfig.name} home`"
          class="app-brand-link mr-3"
          :to="{ name: 'home' }"
        >
          <v-img
            :alt="`${appConfig.name} logo`"
            class="app-brand-logo"
            cover
            height="56"
            :src="brandLogoUrl"
            width="56"
          />
        </RouterLink>
        <v-app-bar-title>
          <span class="text-h6 text-sm-h5 font-weight-bold text-primary">
            {{ appConfig.name }}
          </span>
          <span class="d-none d-sm-block text-caption text-medium-emphasis">
            {{ appConfig.tagline }}
          </span>
        </v-app-bar-title>
        <v-spacer />
        <nav class="d-flex ga-1" aria-label="Primary navigation">
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'home' }"
            variant="text"
          >
            Home
          </v-btn>
          <v-menu>
            <template #activator="{ props }">
              <v-btn append-icon="mdi-menu-down" size="small" v-bind="props">
                Decks
              </v-btn>
            </template>
            <v-list>
              <v-list-item :to="{ name: 'deck-library' }" title="All Decks" />
              <v-list-item :to="{ name: 'public-decks' }" title="Public Decks" />
              <v-list-item
                prepend-icon="mdi-plus"
                title="New Deck"
                @click="createNewDeck"
              />
            </v-list>
          </v-menu>
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'metagame' }"
            variant="text"
          >
            Metagame
          </v-btn>
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'tournaments' }"
            variant="text"
          >
            Tournaments
          </v-btn>
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'regions' }"
            variant="text"
          >
            Regions
          </v-btn>
          <v-menu v-if="auth.isSignedIn">
            <template #activator="{ props }">
              <v-btn size="small" v-bind="props" variant="text">
                {{ auth.user?.email ?? 'Account' }}
              </v-btn>
            </template>
            <v-list>
              <v-list-item
                v-if="isAdmin"
                :to="{ name: 'admin-ingestion' }"
                title="Admin Panel"
              />
              <v-list-item
                v-if="isAdmin"
                :to="{ name: 'admin-data-health' }"
                title="Data Health"
              />
              <v-divider />
              <v-list-item title="Sign Out" @click="auth.signOut" />
            </v-list>
          </v-menu>
          <v-btn
            v-else
            color="primary"
            size="small"
            :to="{ name: 'auth' }"
            variant="text"
          >
            Sign In
          </v-btn>
        </nav>
      </v-container>
    </v-app-bar>

    <v-main>
      <v-container class="content-container py-6 py-md-8" fluid>
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { appConfig } from '../config/app'
import { dataHealthRepository } from '../repositories/dataHealthRepository'
import { useAuthStore } from '../stores/auth'
import { RouterLink, useRouter } from 'vue-router'
import { useDeckStore } from '../stores/deck'

const auth = useAuthStore()
const deckStore = useDeckStore()
const router = useRouter()
const isAdmin = ref(false)

// Navigation is hidden for non-admins; route and database checks still enforce
// authorization because presentation alone is never a security boundary.
watch(
  () => auth.isSignedIn,
  async (signedIn) => {
    isAdmin.value = signedIn
      ? await dataHealthRepository.isCurrentUserAdmin()
      : false
  },
  { immediate: true },
)
// BASE_URL keeps the logo working from a GitHub Pages repository subdirectory.
const brandLogoUrl =
  `${import.meta.env.BASE_URL}brand/oracle-app-icon-1024.png`

function createNewDeck() {
  deckStore.createDeck(undefined, auth.username)
  void router.push({ name: 'deck-builder' })
}
</script>
