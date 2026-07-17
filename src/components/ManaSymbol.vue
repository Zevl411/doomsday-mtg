<template>
  <i
    :aria-hidden="decorative || undefined"
    :aria-label="decorative ? undefined : label"
    :class="['ms', `ms-${normalizedSymbol.toLowerCase()}`, 'ms-cost', sizeClass]"
    :role="decorative ? undefined : 'img'"
    :title="decorative ? undefined : label"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

const props = withDefaults(
  defineProps<{
    symbol: string
    decorative?: boolean
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    decorative: false,
    size: 'medium',
  },
)

const supportedSymbols = new Set<ManaColor>([
  'W',
  'U',
  'B',
  'R',
  'G',
  'C',
])

// Scryfall color identities use WUBRG. Unknown values degrade to colorless
// rather than producing a broken font class.
const normalizedSymbol = computed<ManaColor>(() => {
  const symbol = props.symbol.toUpperCase() as ManaColor
  return supportedSymbols.has(symbol) ? symbol : 'C'
})

const symbolNames: Record<ManaColor, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
}

const label = computed(() => `${symbolNames[normalizedSymbol.value]} mana`)
const sizeClass = computed(() => `mana-symbol--${props.size}`)
</script>

<style scoped>
.mana-symbol--small {
  font-size: 1rem;
}

.mana-symbol--medium {
  font-size: 1.25rem;
}

.mana-symbol--large {
  font-size: 1.5rem;
}
</style>
