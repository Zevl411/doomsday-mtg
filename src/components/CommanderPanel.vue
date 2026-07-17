<template>
  <v-card border class="h-100" color="surface" rounded="lg" variant="flat">
    <v-card-title class="px-5 pt-5">Commander Search</v-card-title>
    <v-card-subtitle class="px-5">
      Find and manage your selected Commander
    </v-card-subtitle>

    <v-card-text class="pa-5">
      <CardSearch
        commander-only
        :selected-card-ids="selectedCommanderIds"
        @card-hovered="deckStore.setPreviewCard"
        @card-selected="deckStore.setCommander"
      />

      <template v-if="commander && canHavePartner(commander)">
        <v-divider class="my-5" />
        <p class="mb-3 text-subtitle-1 font-weight-medium">
          Partner Commander
        </p>
        <CardSearch
          commander-only
          :search-filter="partnerSearchFilter"
          :selected-card-ids="selectedCommanderIds"
          @card-hovered="deckStore.setPreviewCard"
          @card-selected="selectPartner"
        />
        <v-alert
          v-if="partnerError"
          class="mt-3"
          density="compact"
          type="error"
          variant="tonal"
        >
          {{ partnerError }}
        </v-alert>
      </template>
    </v-card-text>

    <v-divider />

    <div
      v-if="commander"
      aria-label="Selected Commander"
      tabindex="0"
      @focusin.self="deckStore.setPreviewCard(commander)"
      @mouseenter="deckStore.setPreviewCard(commander)"
    >
      <v-img
        v-if="getCardImage(commander)"
        :alt="`${commander.name} card art`"
        aspect-ratio="0.716"
        class="commander-image mx-5 mt-4 rounded-lg"
        cover
        :src="getCardImage(commander)"
      />

      <v-card-title class="px-5 pt-5 text-wrap">
        {{ commander.name }}
      </v-card-title>
      <v-card-subtitle class="px-5 text-wrap">
        {{ commander.type_line }}
      </v-card-subtitle>
      <v-card-text class="px-5 pb-2 text-medium-emphasis">
        <span class="mr-2">Color identity:</span>
        <ColorIdentitySymbols
          :colors="commander.color_identity"
          size="medium"
        />
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-btn
          color="secondary"
          variant="outlined"
          @click="deckStore.clearCommander"
        >
          Clear commander
        </v-btn>
      </v-card-actions>

      <template v-if="partnerCommander">
        <v-divider class="mx-5" />
        <div
          aria-label="Selected Partner Commander"
          tabindex="0"
          @focusin="deckStore.setPreviewCard(partnerCommander)"
          @mouseenter="deckStore.setPreviewCard(partnerCommander)"
        >
          <v-img
            v-if="getCardImage(partnerCommander)"
            :alt="`${partnerCommander.name} card art`"
            aspect-ratio="0.716"
            class="commander-image mx-5 mt-4 rounded-lg"
            cover
            :src="getCardImage(partnerCommander)"
          />
          <v-card-title class="px-5 pt-5 text-wrap">
            {{ partnerCommander.name }}
          </v-card-title>
          <v-card-subtitle class="px-5 text-wrap">
            {{ partnerCommander.type_line }}
          </v-card-subtitle>
          <v-card-text class="px-5 pb-2 text-medium-emphasis">
            <span class="mr-2">Color identity:</span>
            <ColorIdentitySymbols
              :colors="partnerCommander.color_identity"
              size="medium"
            />
          </v-card-text>
          <v-card-actions class="px-5 pb-5">
            <v-btn
              color="secondary"
              variant="outlined"
              @click="deckStore.clearPartnerCommander"
            >
              Clear partner
            </v-btn>
          </v-card-actions>
        </div>
      </template>
    </div>

    <v-card-text v-else class="px-5 pb-5 text-medium-emphasis">
      No commander selected.
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CardSearch from './CardSearch.vue'
import ColorIdentitySymbols from './ColorIdentitySymbols.vue'
import { useDeckStore } from '../stores/deck'
import { getCardImage } from '../utils/cardDisplay'
import type { ScryfallCard } from '../types/card'
import {
  canHavePartner,
  getPartnerSearchFilter,
} from '../utils/commanderPairing'

const deckStore = useDeckStore()
const commander = computed(() => deckStore.deck.commander)
const partnerCommander = computed(() => deckStore.deck.partnerCommander ?? null)
const partnerError = ref('')
const selectedCommanderIds = computed(() =>
  [commander.value?.id, partnerCommander.value?.id].filter(
    (id): id is string => Boolean(id),
  ),
)
const partnerSearchFilter = computed(() =>
  commander.value ? getPartnerSearchFilter(commander.value) : '',
)

function selectPartner(card: ScryfallCard) {
  const result = deckStore.setPartnerCommander(card)
  partnerError.value = result.allowed
    ? ''
    : result.reason ?? 'Those commanders cannot be paired.'
}
</script>
