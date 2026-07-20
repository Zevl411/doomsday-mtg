<template>
  <v-card
    :aria-label="cardAriaLabel"
    border
    color="surface"
    rounded="lg"
    :tabindex="card.backImageUrl ? 0 : undefined"
    variant="flat"
    @blur="showBack = false"
    @focus="showBack = true"
    @mouseenter="showBack = true"
    @mouseleave="showBack = false"
  >
    <v-img
      :alt="`${card.name} card image`"
      aspect-ratio="0.716"
      class="full-card-image"
      cover
      :src="displayedImageUrl"
    >
      <v-chip
        v-if="card.quantity > 1"
        class="ma-2 quantity-chip"
        color="secondary"
        size="small"
        variant="flat"
      >
        {{ card.quantity }}×
      </v-chip>
    </v-img>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TournamentDeckCard } from '../models/tournament'

const props = defineProps<{
  card: TournamentDeckCard
}>()

const showBack = ref(false)
const displayedImageUrl = computed(() =>
  showBack.value && props.card.backImageUrl
    ? props.card.backImageUrl
    : props.card.imageUrl,
)
const cardAriaLabel = computed(() =>
  props.card.backImageUrl
    ? `${props.card.name}. Focus or hover to view the back face.`
    : props.card.name,
)
</script>

<style scoped>
.quantity-chip {
  float: right;
}
</style>
