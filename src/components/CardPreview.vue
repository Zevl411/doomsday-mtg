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
      <div
        v-if="getCardImage(card, 'large')"
        class="card-preview-image mx-5 mt-4 rounded-lg"
      >
        <DoubleFacedCardImage
          aspect-ratio="0.716"
          :card="card"
          cover
          image-size="large"
        />
        <FoilCardOverlay v-if="foil" />
      </div>

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
            <div class="card-preview-line d-flex justify-space-between ga-3">
              <h3 class="card-preview-copy text-subtitle-1 font-weight-bold">
                {{ cardFace.name }}
              </h3>
              <ManaCost
                v-if="cardFace.mana_cost"
                :cost="cardFace.mana_cost"
              />
            </div>
            <p class="text-body-2 text-medium-emphasis">
              {{ cardFace.type_line }}
            </p>
            <OracleText
              v-if="cardFace.oracle_text"
              class="mt-3 text-body-2"
              :text="cardFace.oracle_text"
            />
          </v-sheet>
        </template>

        <template v-else>
          <div class="card-preview-line d-flex justify-space-between ga-3">
            <p class="card-preview-copy text-body-2 text-medium-emphasis">
              {{ card.type_line }}
            </p>
            <ManaCost v-if="card.mana_cost" :cost="card.mana_cost" />
          </div>
          <OracleText
            v-if="card.oracle_text"
            class="mt-3 text-body-2"
            :text="card.oracle_text"
          />
        </template>
      </v-card-text>
    </template>

    <v-card-text v-else class="px-5 pb-5 text-medium-emphasis">
      Hover over a search result or deck card to inspect it.
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { ScryfallCard } from '../types/card'
import DoubleFacedCardImage from './DoubleFacedCardImage.vue'
import ManaCost from './ManaCost.vue'
import OracleText from './OracleText.vue'
import { getCardImage } from '../utils/cardDisplay'
import FoilCardOverlay from './FoilCardOverlay.vue'

withDefaults(defineProps<{
  card: ScryfallCard | null
  foil?: boolean
}>(), {
  foil: false,
})

</script>

<style scoped>
.card-preview-line {
  align-items: flex-start;
}

.card-preview-copy {
  min-width: 0;
  overflow-wrap: anywhere;
}

.card-preview-image {
  overflow: hidden;
  position: relative;
}
</style>
