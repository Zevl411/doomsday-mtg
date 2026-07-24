<template>
  <div class="oracle-text">
    <span v-for="(line, lineIndex) in parsedLines" :key="lineIndex" class="oracle-text__line">
      <template v-for="(segment, segmentIndex) in line" :key="`${lineIndex}-${segmentIndex}`">
        <ManaSymbol
          v-if="segment.symbol"
          class="oracle-text__symbol"
          size="small"
          :symbol="segment.symbol"
        />
        <template v-else>{{ segment.text }}</template>
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ManaSymbol from './ManaSymbol.vue';

interface OracleTextSegment {
  symbol?: string;
  text?: string;
}

const props = defineProps<{
  text: string;
}>();

const supportedSymbol =
  /^(?:[WUBRGCXYZSEQ]|T|[0-9]|1[0-9]|20|[WUBRG]\/P|[WUBRG]\/[WUBRG]|2\/[WUBRG])$/;

/**
 * Scryfall oracle text is authoritative plain text containing brace-wrapped
 * symbols. Splitting instead of using HTML preserves untrusted text verbatim
 * while allowing known symbols and original line boundaries to render.
 */
const parsedLines = computed<OracleTextSegment[][]>(() =>
  props.text.split('\n').map((line) =>
    line
      .split(/(\{[^}]+\})/g)
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^\{([^}]+)\}$/);
        const symbol = match?.[1];
        return symbol && supportedSymbol.test(symbol) ? { symbol } : { text: part };
      }),
  ),
);
</script>

<style scoped>
.oracle-text__line {
  display: block;
  min-height: 1.25em;
}

.oracle-text__line + .oracle-text__line {
  margin-top: 0.35rem;
}

.oracle-text__symbol {
  margin-inline: 0.08em;
  transform: translateY(-0.06em);
}
</style>
