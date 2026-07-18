<template>
  <v-card
    :aria-label="card.name"
    border
    color="surface"
    rounded="lg"
    variant="flat"
  >
    <v-img
      :alt="`${card.name} card image`"
      aspect-ratio="0.716"
      cover
      :src="card.imageUrl"
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
    <v-card-text class="pa-3">
      <div class="text-body-2 font-weight-medium">
        <span v-if="card.quantity > 1">{{ card.quantity }}× </span>{{ card.name }}
      </div>
      <div v-if="card.manaCost" class="text-caption text-medium-emphasis">
        {{ card.manaCost }}
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { TournamentDeckCard } from '../models/tournament'

defineProps<{
  card: TournamentDeckCard
}>()
</script>

<style scoped>
.quantity-chip {
  float: right;
}
</style>
