<template>
  <v-app>
    <v-app-bar border="b" color="surface" flat height="76">
      <v-container
        class="d-flex align-center mx-auto px-3 px-md-6"
      >
        <v-app-bar-nav-icon
          class="d-md-none"
          density="comfortable"
          variant="text"
          @click="showMobileMenu = true"
        />
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
        <span
          aria-hidden="true"
          class="nav-section-divider d-none d-md-inline-block"
        />
        <nav
          class="primary-nav d-none d-md-flex align-center ga-1"
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
          class="primary-nav deck-navigation d-none d-md-flex align-center ga-1 mr-2"
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
        <span
          v-if="!auth.isSignedIn"
          class="d-md-none mr-2"
        >
          <v-btn
            color="primary"
            size="small"
            :to="{ name: 'auth' }"
            variant="text"
          >
            Sign In
          </v-btn>
        </span>
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

    <v-navigation-drawer
      v-model="showMobileMenu"
      class="d-md-none"
      location="start"
      temporary
    >
      <v-list
        color="surface"
        density="comfortable"
        nav
      >
        <v-list-item
          :to="{ name: 'home' }"
          prepend-icon="mdi-home"
          title="Home"
          color="primary"
        />
        <v-list-subheader>Events</v-list-subheader>
        <v-list-item
          :to="{ name: 'metagame' }"
          prepend-icon="mdi-cards-playing-outline"
          title="Metagame"
        />
        <v-list-item
          :to="{ name: 'tournaments' }"
          prepend-icon="mdi-tournament"
          title="Tournaments"
        />
        <v-list-subheader>Decks</v-list-subheader>
        <v-list-item
          :to="{ name: 'public-decks' }"
          prepend-icon="mdi-magnify"
          title="Explore Decks"
        />
        <v-list-item
          :to="{ name: 'deck-library' }"
          prepend-icon="mdi-library"
          title="My Decks"
        />
        <v-list-item
          prepend-icon="mdi-plus"
          title="Create a deck"
          @click="openCreateDeckFromMenu"
        />
        <v-divider />
        <v-list-subheader v-if="auth.isSignedIn && isAdmin">Admin</v-list-subheader>
        <v-list-item
          v-if="auth.isSignedIn && isAdmin"
          :to="{ name: 'admin-ingestion' }"
          title="Admin Panel"
        />
        <v-list-item
          v-if="auth.isSignedIn && isAdmin"
          :to="{ name: 'admin-data-health' }"
          title="Data Health"
        />
        <v-list-subheader>Account</v-list-subheader>
        <v-list-item
          prepend-icon="mdi-cog"
          title="Preferences"
          @click="openPreferences"
        />
        <v-list-item
          prepend-icon="mdi-logout"
          title="Sign Out"
          @click="auth.signOut"
        />
      </v-list>
    </v-navigation-drawer>

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
            label="Limit Deckbuilder card search to Commander colors"
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
            @update:model-value="applyDeckBuilderSearchSide"
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
import type {
  DeckBuilderSearchSide,
  UserPreferences,
} from '../models/userPreferences'

const auth = useAuthStore()
const preferencesStore = useUserPreferencesStore()
const router = useRouter()
const isAdmin = ref(false)
const showCreateDialog = ref(false)
const showMobileMenu = ref(false)
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

function openCreateDeckFromMenu() {
  showMobileMenu.value = false
  showCreateDialog.value = true
}

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

/*
 * Serialize rapid toggle changes so an earlier request cannot overwrite a
 * newer choice after the user has already moved the layout again.
 */
let searchSideSaveQueue = Promise.resolve()

function applyDeckBuilderSearchSide(value: unknown) {
  if (value !== 'left' && value !== 'right') return
  const side: DeckBuilderSearchSide = value
  searchSideSaveQueue = searchSideSaveQueue.then(async () => {
    const saved = await preferencesStore.saveDeckBuilderSearchSide(side)
    if (saved) {
      preferenceError.value = ''
      return
    }
    preferenceError.value = 'Unable to save search placement.'
    // Only undo the draft if the user has not already made a newer choice.
    if (preferenceDraft.deckBuilderSearchSide === side) {
      preferenceDraft.deckBuilderSearchSide =
        preferencesStore.values.deckBuilderSearchSide
    }
  })
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
