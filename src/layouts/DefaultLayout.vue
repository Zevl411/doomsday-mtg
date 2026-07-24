<template>
  <v-app>
    <v-app-bar border="b" color="surface" flat height="76">
      <v-container
        class="d-flex align-center mx-auto px-3 px-md-6"
      >
        <v-btn
          aria-label="Open navigation"
          class="mobile-navigation-toggle d-md-none"
          density="comfortable"
          icon
          variant="text"
          @click="showMobileMenu = true"
        >
          <svg
            aria-hidden="true"
            class="mobile-navbar-icon"
            viewBox="0 0 24 24"
          >
            <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
          </svg>
        </v-btn>
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
        <div class="app-brand-title mr-2 mr-md-4">
          <span class="app-brand-title__text font-weight-bold text-primary">
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
        <v-menu v-if="auth.isSignedIn">
          <template #activator="{ props }">
            <v-btn
              aria-label="Open account menu"
              class="account-menu-button"
              size="small"
              v-bind="props"
              variant="text"
            >
              <svg
                aria-hidden="true"
                class="mobile-account-icon d-md-none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 12c5.5 0 9 2.8 9 5.5V22H3v-2.5C3 16.8 6.5 14 12 14Zm0-10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 12c-4.3 0-7 2-7 3.5v.5h14v-.5C19 18 16.3 16 12 16Z"
                />
              </svg>
              <span class="d-none d-md-inline">
                {{ auth.user?.email ?? 'Account' }}
              </span>
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
          class="d-none d-md-inline-flex"
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
      class="mobile-navigation-drawer d-md-none"
      color="surface"
      location="start"
      temporary
      width="300"
    >
      <div class="mobile-drawer-header">
        <v-img
          alt=""
          class="mobile-drawer-logo"
          cover
          height="40"
          :src="brandLogoUrl"
          width="40"
        />
        <div>
          <div class="mobile-drawer-title">{{ appConfig.name }}</div>
          <div class="mobile-drawer-subtitle">Commander deck tools</div>
        </div>
        <v-spacer />
        <v-btn
          aria-label="Close navigation"
          class="mobile-drawer-close"
          icon
          size="small"
          variant="text"
          @click="showMobileMenu = false"
        >
          <svg
            aria-hidden="true"
            class="mobile-drawer-close-icon"
            viewBox="0 0 24 24"
          >
            <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
          </svg>
        </v-btn>
      </div>
      <v-divider />
      <v-list
        bg-color="transparent"
        class="mobile-drawer-list"
        color="primary"
        density="comfortable"
        nav
      >
        <v-list-subheader>Browse</v-list-subheader>
        <v-list-item
          class="mobile-drawer-item"
          :to="{ name: 'home' }"
          title="Home"
        />
        <v-list-item
          class="mobile-drawer-item"
          :to="{ name: 'metagame' }"
          title="Metagame"
        />
        <v-list-item
          class="mobile-drawer-item"
          :to="{ name: 'tournaments' }"
          title="Tournaments"
        />
        <v-list-subheader>Decks</v-list-subheader>
        <v-list-item
          class="mobile-drawer-item"
          :to="{ name: 'public-decks' }"
          title="Explore Decks"
        />
        <v-list-item
          class="mobile-drawer-item"
          :to="{ name: 'deck-library' }"
          title="My Decks"
        />
        <v-list-item
          class="mobile-drawer-item mobile-drawer-item--create"
          title="Create a deck"
          @click="openCreateDeckFromMenu"
        />
        <v-divider class="my-3" />
        <v-list-subheader v-if="auth.isSignedIn && isAdmin">
          Administration
        </v-list-subheader>
        <v-list-item
          v-if="auth.isSignedIn && isAdmin"
          class="mobile-drawer-item"
          :to="{ name: 'admin-ingestion' }"
          title="Admin Panel"
        />
        <v-list-item
          v-if="auth.isSignedIn && isAdmin"
          class="mobile-drawer-item"
          :to="{ name: 'admin-data-health' }"
          title="Data Health"
        />
        <v-list-subheader>Account</v-list-subheader>
        <v-list-item
          class="mobile-drawer-item"
          title="Preferences"
          @click="openPreferences"
        />
        <v-list-item
          v-if="auth.isSignedIn"
          class="mobile-drawer-item"
          title="Sign Out"
          @click="auth.signOut"
        />
        <v-list-item
          v-else
          class="mobile-drawer-item"
          :to="{ name: 'auth' }"
          title="Sign In"
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
watch(
  () => router.currentRoute.value.fullPath,
  () => {
    showMobileMenu.value = false
  },
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

.app-brand-title__text {
  font-size: 2rem;
  line-height: 1;
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

.mobile-navbar-icon,
.mobile-account-icon,
.mobile-drawer-close-icon {
  fill: currentColor;
  height: 22px;
  width: 22px;
}

.mobile-drawer-header {
  align-items: center;
  display: flex;
  gap: 12px;
  min-height: 72px;
  padding: 12px 10px 12px 16px;
}

.mobile-drawer-logo {
  flex: 0 0 40px;
}

.mobile-drawer-title {
  color: rgb(var(--v-theme-primary));
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
}

.mobile-drawer-subtitle {
  color: rgba(var(--v-theme-on-surface), 0.66);
  font-size: 0.72rem;
}

.mobile-drawer-close {
  color: rgb(var(--v-theme-primary)) !important;
}

.mobile-drawer-list {
  padding: 8px;
}

.mobile-drawer-list :deep(.v-list-subheader) {
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  min-height: 32px;
  padding-inline: 12px;
  text-transform: uppercase;
}

.mobile-drawer-item {
  border-left: 3px solid transparent;
  margin-bottom: 2px;
  min-height: 46px;
  padding-inline: 13px;
}

.mobile-drawer-item :deep(.v-list-item-title) {
  font-size: 0.92rem;
  font-weight: 600;
}

.mobile-drawer-item.v-list-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
  border-left-color: rgb(var(--v-theme-primary));
}

.mobile-drawer-item--create {
  color: rgb(var(--v-theme-primary));
}

.deck-builder-side-toggle {
  display: flex;
  width: 100%;
}

.deck-builder-side-toggle :deep(.v-btn) {
  flex: 1 1 50%;
}

@media (max-width: 599px) {
  .mobile-navigation-toggle {
    color: rgb(var(--v-theme-primary)) !important;
    margin-inline-start: -8px;
    min-width: 44px;
    width: 44px;
  }

  .app-brand-title__text {
    font-size: 1.15rem;
  }

  .account-menu-button {
    color: rgb(var(--v-theme-primary)) !important;
    min-width: 40px;
    padding-inline: 8px;
  }
}
</style>
