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
        <div class="app-brand-title mr-4">
          <span class="text-h5 text-sm-h4 font-weight-bold text-primary">
            {{ appConfig.name }}
          </span>
        </div>
        <span aria-hidden="true" class="nav-section-divider" />
        <nav
          class="primary-nav d-flex align-center ga-1"
          aria-label="Primary navigation"
        >
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
        </nav>
        <v-spacer />
        <nav
          class="primary-nav deck-navigation d-flex align-center ga-1 mr-2"
          aria-label="Deck navigation"
        >
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'public-decks' }"
            variant="text"
          >
            Explore Decks
          </v-btn>
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'deck-library' }"
            variant="text"
          >
            My Decks
          </v-btn>
          <v-btn
            aria-label="Create a deck"
            class="create-deck-nav-button ml-1"
            icon
            size="small"
            title="Create a deck"
            variant="text"
            @click="showCreateDialog = true"
          >
            <svg
              aria-hidden="true"
              class="nav-action-icon"
              viewBox="0 0 24 24"
            >
              <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
            </svg>
          </v-btn>
        </nav>
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
            <v-list-item title="Preferences" @click="openPreferences" />
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
      </v-container>
    </v-app-bar>

    <v-main>
      <v-container class="content-container py-6 py-md-8" fluid>
        <slot />
      </v-container>
    </v-main>

    <DeckCreationDialog
      v-model="showCreateDialog"
      @created="openCreatedDeck"
    />

    <v-dialog v-model="showPreferences" max-width="560">
      <v-card>
        <v-card-title>User Preferences</v-card-title>
        <v-card-text>
          <v-select
            v-model="preferenceDraft.defaultDeckDisplay"
            :items="displayOptions"
            label="Default deck display"
          />
          <v-select
            v-model="preferenceDraft.defaultPrimaryGrouping"
            :items="groupingOptions"
            label="Default grouping"
          />
          <v-select
            v-model="preferenceDraft.defaultSecondaryGrouping"
            :items="secondaryGroupingOptions"
            label="Default secondary grouping"
          />
          <v-select
            v-model="preferenceDraft.defaultDeckVisibility"
            :items="visibilityOptions"
            label="Default new-deck visibility"
          />
          <v-switch
            v-model="preferenceDraft.defaultCommanderColorFilter"
            color="primary"
            label="Limit card search to Commander colors by default"
          />
          <div class="mb-2 mt-2 text-subtitle-2">
            Deck Builder Search
          </div>
          <v-btn-toggle
            v-model="preferenceDraft.deckBuilderSearchSide"
            class="deck-builder-side-toggle mb-4"
            color="primary"
            divided
            mandatory
            variant="outlined"
          >
            <v-btn value="left">
              <v-icon class="mr-2" icon="mdi-dock-left" />
              Left
            </v-btn>
            <v-btn value="right">
              <v-icon class="mr-2" icon="mdi-dock-right" />
              Right
            </v-btn>
          </v-btn-toggle>
          <div class="mb-2 text-subtitle-2">
            Deck Statistics
          </div>
          <v-btn-toggle
            v-model="preferenceDraft.deckStatisticsPosition"
            class="deck-builder-side-toggle mb-4"
            color="primary"
            divided
            mandatory
            variant="outlined"
          >
            <v-btn value="above">
              <v-icon class="mr-2" icon="mdi-dock-top" />
              Above Boards
            </v-btn>
            <v-btn value="below">
              <v-icon class="mr-2" icon="mdi-dock-bottom" />
              Below Boards
            </v-btn>
          </v-btn-toggle>
          <v-alert v-if="preferenceError" type="error" variant="tonal">
            {{ preferenceError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showPreferences = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="savePreferences">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { appConfig } from '../config/app'
import DeckCreationDialog from '../components/DeckCreationDialog.vue'
import { dataHealthRepository } from '../repositories/dataHealthRepository'
import { useAuthStore } from '../stores/auth'
import { RouterLink, useRouter } from 'vue-router'
import { useUserPreferencesStore } from '../stores/userPreferences'
import type { UserPreferences } from '../models/userPreferences'

const auth = useAuthStore()
const preferencesStore = useUserPreferencesStore()
const router = useRouter()
const isAdmin = ref(false)
const showCreateDialog = ref(false)
const showPreferences = ref(false)
const preferenceError = ref('')
const preferenceDraft = reactive<UserPreferences>({
  ...preferencesStore.values,
})
const displayOptions = [
  { title: 'Grid', value: 'grid' },
  { title: 'List', value: 'list' },
]
const groupingOptions = [
  { title: 'Name', value: 'name' },
  { title: 'Mana cost', value: 'mana' },
  { title: 'Card type', value: 'type' },
  { title: 'Color', value: 'color' },
]
const secondaryGroupingOptions = [
  { title: 'None', value: 'none' },
  ...groupingOptions,
]
const visibilityOptions = [
  { title: 'Private', value: 'private' },
  { title: 'Unlisted', value: 'unlisted' },
  { title: 'Public', value: 'public' },
]

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
  `${import.meta.env.BASE_URL}brand/oracle-wheel-header.png`

function openCreatedDeck(deckId: string) {
  void router.push({ name: 'deck-builder', params: { deckId } })
}

function openPreferences() {
  Object.assign(preferenceDraft, preferencesStore.values)
  preferenceError.value = ''
  showPreferences.value = true
}

async function savePreferences() {
  const saved = await preferencesStore.save({ ...preferenceDraft })
  preferenceError.value = saved ? '' : 'Unable to save preferences.'
  if (saved) showPreferences.value = false
}
</script>

<style scoped>
.app-brand-title {
  flex: 0 0 auto;
  white-space: nowrap;
}

.primary-nav {
  min-height: 36px;
}

.primary-nav > :deep(.v-btn) {
  height: 36px;
  min-height: 36px;
  padding-inline: 14px;
}

.primary-nav > :deep(.create-deck-nav-button) {
  height: 32px;
  min-height: 32px;
  min-width: 32px;
  padding-inline: 0;
  width: 32px;
}

.nav-section-divider {
  align-self: center;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
  height: 26px;
  margin-inline: 8px;
  width: 1px;
}

.nav-action-icon {
  fill: rgb(var(--v-theme-primary));
  height: 18px;
  width: 18px;
}

.deck-builder-side-toggle {
  display: flex;
  width: 100%;
}

.deck-builder-side-toggle :deep(.v-btn) {
  flex: 1 1 50%;
}
</style>
