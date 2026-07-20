<template>
  <i
    :aria-hidden="decorative || undefined"
    :aria-label="decorative ? undefined : label"
    :class="['ms', symbolClass, 'ms-cost', sizeClass]"
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
const genericSymbols = new Set([
  ...Array.from({ length: 21 }, (_, value) => String(value)),
  'X', 'Y', 'Z', 'S', 'E', 'T', 'Q',
])

// Scryfall uses slashes in hybrid symbols and single letters for action
// symbols. Unknown values degrade to colorless rather than a broken font class.
const normalizedSymbol = computed(() => {
  const symbol = props.symbol.toUpperCase().replace('/', '')
  return baseSymbols.has(symbol)
    || hybridSymbols.has(symbol)
    || genericSymbols.has(symbol)
    ? symbol
    : 'C'
})
const symbolClass = computed(() => {
  if (normalizedSymbol.value === 'T') return 'ms-tap'
  if (normalizedSymbol.value === 'Q') return 'ms-untap'
  return `ms-${normalizedSymbol.value.toLowerCase()}`
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
  if (normalizedSymbol.value === 'T') return 'Tap symbol'
  if (normalizedSymbol.value === 'Q') return 'Untap symbol'
  if (normalizedSymbol.value === 'E') return 'Energy symbol'
  if (normalizedSymbol.value === 'S') return 'Snow mana'
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
