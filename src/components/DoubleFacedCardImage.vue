<template>
  <v-img
    :aria-label="ariaLabel"
    :alt="`${card.name} card art`"
    :aspect-ratio="aspectRatio"
    class="full-card-image"
    :cover="cover"
    :src="displayedImage"
    :tabindex="backImage ? 0 : undefined"
    @blur="showBack = false"
    @focus="showBack = true"
    @mouseenter="showBack = true"
    @mouseleave="showBack = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ScryfallCard } from '../types/card'
import {
  getCardFaceImage,
  getCardImage,
  type CardImageSize,
} from '../utils/cardDisplay'

const props = withDefaults(defineProps<{
  card: ScryfallCard
  imageSize?: CardImageSize
  aspectRatio?: string | number
  cover?: boolean
}>(), {
  imageSize: 'normal',
  aspectRatio: 0.716,
  cover: true,
})

const showBack = ref(false)
const frontImage = computed(() => getCardImage(props.card, props.imageSize))
const backImage = computed(() =>
  getCardFaceImage(props.card, 1, props.imageSize),
)
const displayedImage = computed(() =>
  showBack.value && backImage.value ? backImage.value : frontImage.value,
)
const ariaLabel = computed(() =>
  backImage.value
    ? `${props.card.name}. Focus or hover to view the back face.`
    : props.card.name,
)

watch(() => props.card.id, () => {
  showBack.value = false
})
</script>
