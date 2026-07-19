<template>
  <v-card
    border
    class="preview-panel"
    color="surface-bright"
    rounded="lg"
    variant="flat"
  >
    <v-card-title class="widget-header-bar px-5 py-3">
      Card Preview
    </v-card-title>

    <template v-if="card">
      <DoubleFacedCardImage
        v-if="getCardImage(card, 'large')"
        aspect-ratio="0.716"
        :card="card"
        class="mx-5 mt-4 rounded-lg"
        cover
        image-size="large"
      />

      <v-card-title class="px-5 pt-5 text-wrap">
        {{ card.name }}
      </v-card-title>

      <v-card-text class="px-5">
        <template v-if="card.card_faces?.length">
          <v-sheet
            v-for="cardFace in card.card_faces"
            :key="cardFace.name"
            class="mb-5"
            color="transparent"
          >
            <div class="d-flex justify-space-between ga-3">
              <h3 class="text-subtitle-1 font-weight-bold">
                {{ cardFace.name }}
              </h3>
              <span v-if="cardFace.mana_cost" class="text-body-2">
                {{ cardFace.mana_cost }}
              </span>
            </div>
            <p class="text-body-2 text-medium-emphasis">
              {{ cardFace.type_line }}
            </p>
            <p v-if="cardFace.oracle_text" class="mt-3 text-body-2">
              {{ cardFace.oracle_text }}
            </p>
          </v-sheet>
        </template>

        <template v-else>
          <div class="d-flex justify-space-between ga-3">
            <p class="text-body-2 text-medium-emphasis">
              {{ card.type_line }}
            </p>
            <span v-if="card.mana_cost" class="text-body-2">
              {{ card.mana_cost }}
            </span>
          </div>
          <p v-if="card.oracle_text" class="mt-3 text-body-2">
            {{ card.oracle_text }}
          </p>
        </template>

        <div class="mt-4">
          <p class="mb-2 text-caption text-medium-emphasis">Color identity</p>
          <ColorIdentitySymbols :colors="card.color_identity" size="large" />
        </div>
      </v-card-text>
    </template>

    <v-card-text v-else class="px-5 pb-5 text-medium-emphasis">
      Hover over a search result or deck card to inspect it.
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { ScryfallCard } from '../types/card'
import ColorIdentitySymbols from './ColorIdentitySymbols.vue'
import DoubleFacedCardImage from './DoubleFacedCardImage.vue'
import { getCardImage } from '../utils/cardDisplay'

defineProps<{
  card: ScryfallCard | null
}>()

</script>
