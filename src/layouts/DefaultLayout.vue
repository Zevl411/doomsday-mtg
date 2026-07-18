<template>
  <v-app>
    <v-app-bar border="b" color="surface" flat height="76">
      <v-container class="d-flex align-center mx-auto px-4 px-sm-6">
        <v-btn
          :active="false"
          :aria-label="`Go to ${appConfig.name} home`"
          class="app-brand-link mr-3"
          icon
          :ripple="false"
          :to="{ name: 'home' }"
          variant="plain"
        >
          <v-img
            :alt="`${appConfig.name} logo`"
            class="app-brand-logo"
            cover
            height="56"
            :src="brandLogoUrl"
            width="56"
          />
        </v-btn>
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
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'deck-library' }"
            variant="text"
          >
            Decks
          </v-btn>
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'deck-builder' }"
            variant="text"
          >
            <span class="d-none d-sm-inline">Deck Builder</span>
            <span class="d-sm-none">Builder</span>
          </v-btn>
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
                :to="{ name: 'admin-ingestion' }"
                title="Admin Panel"
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
import { appConfig } from '../config/app'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
// BASE_URL keeps the logo working from a GitHub Pages repository subdirectory.
const brandLogoUrl =
  `${import.meta.env.BASE_URL}brand/oracle-app-icon-1024.png`
</script>
