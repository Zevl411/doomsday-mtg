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

        <v-sheet
          v-if="marketPrices.length || tcgplayerUrl"
          class="card-preview-pricing mt-5 pa-3"
          color="surface-light"
          rounded="lg"
        >
          <div class="align-center d-flex ga-2 justify-space-between">
            <div>
              <div class="text-subtitle-2">TCGplayer prices</div>
              <div class="text-caption text-medium-emphasis">
                Selected printing · USD
              </div>
            </div>
            <v-btn
              v-if="tcgplayerUrl"
              :href="tcgplayerUrl"
              rel="noopener noreferrer sponsored"
              size="small"
              target="_blank"
              variant="text"
            >
              View
            </v-btn>
          </div>
          <div v-if="marketPrices.length" class="card-preview-price-grid mt-3">
            <div
              v-for="price in marketPrices"
              :key="price.finish"
              class="card-preview-price"
              :class="{
                'card-preview-price--selected':
                  foil ? price.finish === 'Foil' : price.finish === 'Regular',
              }"
            >
              <span class="text-caption text-medium-emphasis">
                {{ price.finish }}
              </span>
              <strong>{{ formatPrice(price.amount) }}</strong>
            </div>
          </div>
        </v-sheet>
      </v-card-text>
    </template>

    <v-card-text v-else class="px-5 pb-5 text-medium-emphasis">
      Hover over a search result or deck card to inspect it.
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { getCardById } from '../api/scryfall'
import type { ScryfallCard } from '../types/card'
import DoubleFacedCardImage from './DoubleFacedCardImage.vue'
import ManaCost from './ManaCost.vue'
import OracleText from './OracleText.vue'
import { getCardImage } from '../utils/cardDisplay'
import FoilCardOverlay from './FoilCardOverlay.vue'
import { useUserPreferencesStore } from '../stores/userPreferences'
import {
  formatCardPrice,
  getCardMarketPrices,
  getTcgplayerPurchaseUrl,
} from '../utils/cardPrice'

const props = withDefaults(defineProps<{
  card: ScryfallCard | null
  foil?: boolean
}>(), {
  foil: false,
})

const preferences = useUserPreferencesStore()
const refreshedCard = ref<ScryfallCard | null>(null)
let priceController: AbortController | null = null

const pricingCard = computed(() => refreshedCard.value ?? props.card)
const marketPrices = computed(() =>
  pricingCard.value ? getCardMarketPrices(pricingCard.value) : [],
)
const tcgplayerUrl = computed(() =>
  pricingCard.value ? getTcgplayerPurchaseUrl(pricingCard.value) : null,
)

watch(
  () => props.card,
  (card) => {
    priceController?.abort()
    refreshedCard.value = null
    if (
      !card ||
      card.prices !== undefined ||
      !isScryfallPrintingId(card.id)
    ) {
      return
    }

    priceController = new AbortController()
    const activeController = priceController
    void getCardById(card.id, activeController.signal)
      .then((freshCard) => {
        if (!activeController.signal.aborted) refreshedCard.value = freshCard
      })
      // Price refresh is supplementary and must never obstruct card details.
      .catch(() => undefined)
  },
  { immediate: true },
)

onUnmounted(() => priceController?.abort())

function formatPrice(amount: number): string {
  return formatCardPrice(amount, preferences.values.priceCurrency)
}

function isScryfallPrintingId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value)
}

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

.card-preview-pricing {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.card-preview-price-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
}

.card-preview-price {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.card-preview-price--selected strong {
  color: rgb(var(--v-theme-primary));
}
</style>
