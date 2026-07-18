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

const baseSymbols = new Set(['W', 'U', 'B', 'R', 'G', 'C'])
const hybridSymbols = new Set([
  'WU', 'WB', 'UB', 'UR', 'BR', 'BG', 'RW', 'RG', 'GW', 'GU',
  '2W', '2U', '2B', '2R', '2G',
  'WP', 'UP', 'BP', 'RP', 'GP',
])

// Scryfall color identities use WUBRG. Unknown values degrade to colorless
// rather than producing a broken font class.
const normalizedSymbol = computed(() => {
  const symbol = props.symbol.toUpperCase().replace('/', '')
  return baseSymbols.has(symbol) || hybridSymbols.has(symbol) ? symbol : 'C'
})

const symbolNames: Record<ManaColor, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
}

const label = computed(() => {
  const name = symbolNames[normalizedSymbol.value as ManaColor]
  return name ? `${name} mana` : `${props.symbol.toUpperCase()} mana`
})
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
