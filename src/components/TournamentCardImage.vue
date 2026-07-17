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
    />
    <v-card-text class="pa-3">
      <div class="text-body-2 font-weight-medium">{{ card.name }}</div>
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
