<template>
  <v-card border class="h-100" color="surface" rounded="lg" variant="flat">
    <v-card-title class="px-5 pt-5">Commander Search</v-card-title>
    <v-card-subtitle class="px-5">
      Find and manage your selected Commander
    </v-card-subtitle>

    <v-card-text class="pa-5">
      <CardSearch
        commander-only
        :selected-card-ids="commander ? [commander.id] : []"
        @card-hovered="deckStore.setPreviewCard"
        @card-selected="deckStore.setCommander"
      />
    </v-card-text>

    <v-divider />

    <div
      v-if="commander"
      aria-label="Selected Commander"
      tabindex="0"
      @focusin="deckStore.setPreviewCard(commander)"
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
    </div>

    <v-card-text v-else class="px-5 pb-5 text-medium-emphasis">
      No commander selected.
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CardSearch from './CardSearch.vue'
import ColorIdentitySymbols from './ColorIdentitySymbols.vue'
import { useDeckStore } from '../stores/deck'
import { getCardImage } from '../utils/cardDisplay'

const deckStore = useDeckStore()
const commander = computed(() => deckStore.deck.commander)

</script>
