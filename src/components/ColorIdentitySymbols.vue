<template>
  <span :aria-label="`Color identity: ${identityLabel}`" class="color-identity-symbols" role="img">
    <ManaSymbol
      v-for="color in displayedColors"
      :key="color"
      decorative
      :size="size"
      :symbol="color"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ManaSymbol, { type ManaColor } from './ManaSymbol.vue';

const props = withDefaults(
  defineProps<{
    colors: string[];
    size?: 'small' | 'medium' | 'large';
  }>(),
  {
    size: 'medium',
  },
);

const colorNames: Record<ManaColor, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

const supportedColors = new Set<ManaColor>(['W', 'U', 'B', 'R', 'G']);

const displayedColors = computed<ManaColor[]>(() => {
  const colors = props.colors
    .map((color) => color.toUpperCase() as ManaColor)
    .filter((color) => supportedColors.has(color));

  return colors.length ? colors : ['C'];
});

const identityLabel = computed(() =>
  displayedColors.value.map((color) => colorNames[color]).join(', '),
);
</script>

<style scoped>
.color-identity-symbols {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  vertical-align: middle;
}
</style>
