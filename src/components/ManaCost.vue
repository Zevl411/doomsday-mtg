<template>
  <span v-if="symbols.length" :aria-label="`Mana cost ${cost}`" class="mana-cost" role="img">
    <template v-for="(symbol, index) in symbols" :key="`${symbol}-${index}`">
      <span v-if="symbol === '//'" aria-hidden="true" class="mana-cost__separator"> // </span>
      <ManaSymbol v-else-if="isFontSymbol(symbol)" decorative size="small" :symbol="symbol" />
      <span v-else aria-hidden="true" class="mana-cost__generic">
        {{ symbol }}
      </span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ManaSymbol from './ManaSymbol.vue';

const props = defineProps<{ cost: string }>();
function isFontSymbol(symbol: string) {
  return /^(?:[WUBRGCXYZSEQ]|T|[0-9]|1[0-9]|20|[WUBRG]\/P|[WUBRG]\/[WUBRG]|2\/[WUBRG])$/.test(
    symbol,
  );
}
const symbols = computed(() => {
  const values: string[] = [];
  for (const section of props.cost.split(/\s*\/\/\s*/)) {
    if (values.length) values.push('//');
    values.push(...[...section.matchAll(/\{([^}]+)\}/g)].map((match) => match[1] ?? ''));
  }
  return values.filter(Boolean);
});
</script>

<style scoped>
.mana-cost {
  display: inline-flex;
  flex-shrink: 0;
  flex-wrap: nowrap;
  gap: 3px;
  align-items: center;
  white-space: nowrap;
}

.mana-cost__generic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 3px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #111;
  background: #beb9b2;
  border-radius: 50%;
}

.mana-cost__separator {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
