<template>
  <div
    :aria-label="label"
    aria-live="polite"
    class="app-skeleton"
    :class="`app-skeleton--${variant}`"
    role="status"
  >
    <template v-if="variant === 'cards'">
      <div v-for="index in count" :key="index" class="app-skeleton__card">
        <div class="app-skeleton__media app-skeleton__pulse" />
        <div class="app-skeleton__line app-skeleton__line--wide app-skeleton__pulse" />
        <div class="app-skeleton__line app-skeleton__line--short app-skeleton__pulse" />
      </div>
    </template>

    <template v-else-if="variant === 'detail'">
      <div class="app-skeleton__hero app-skeleton__pulse" />
      <div class="app-skeleton__detail-grid">
        <div class="app-skeleton__preview app-skeleton__pulse" />
        <div class="app-skeleton__detail-copy">
          <div
            v-for="index in 6"
            :key="index"
            class="app-skeleton__line app-skeleton__pulse"
            :class="index % 3 === 0 ? 'app-skeleton__line--short' : 'app-skeleton__line--wide'"
          />
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'chart'">
      <div class="app-skeleton__line app-skeleton__line--short app-skeleton__pulse" />
      <div class="app-skeleton__chart app-skeleton__pulse" />
    </template>

    <template v-else>
      <div v-for="index in count" :key="index" class="app-skeleton__row">
        <div v-if="variant === 'list'" class="app-skeleton__thumb app-skeleton__pulse" />
        <div class="app-skeleton__row-copy">
          <div class="app-skeleton__line app-skeleton__line--wide app-skeleton__pulse" />
          <div
            v-if="variant !== 'compact'"
            class="app-skeleton__line app-skeleton__line--short app-skeleton__pulse"
          />
        </div>
      </div>
    </template>

    <span class="app-skeleton__sr-only">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Shared loading placeholders mirror common application layouts. The
 * component communicates busy state without coupling data-fetching behavior
 * to a particular route or repository.
 */
withDefaults(
  defineProps<{
    count?: number;
    label?: string;
    variant?: 'cards' | 'chart' | 'compact' | 'detail' | 'list' | 'table';
  }>(),
  {
    count: 5,
    label: 'Loading content',
    variant: 'table',
  },
);
</script>

<style scoped>
.app-skeleton {
  width: 100%;
  min-width: 0;
}

.app-skeleton--cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}

.app-skeleton__card,
.app-skeleton--chart,
.app-skeleton--detail,
.app-skeleton--list,
.app-skeleton--table {
  padding: 12px;
  border: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
}

.app-skeleton__media {
  aspect-ratio: 1.55;
  margin-bottom: 12px;
  border-radius: 4px;
}

.app-skeleton__hero {
  height: 58px;
  margin-bottom: 12px;
  border-radius: 4px;
}

.app-skeleton__detail-grid {
  display: grid;
  grid-template-columns: minmax(150px, 0.3fr) 1fr;
  gap: 16px;
}

.app-skeleton__preview {
  max-height: 300px;
  aspect-ratio: 0.716;
  border-radius: 4px;
}

.app-skeleton__detail-copy,
.app-skeleton__row-copy {
  display: grid;
  gap: 8px;
  align-content: center;
  min-width: 0;
}

.app-skeleton__row {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 48px;
  padding: 7px 4px;
  border-bottom: 1px solid rgb(var(--v-border-color), 0.28);
}

.app-skeleton__row:last-of-type {
  border-bottom: 0;
}

.app-skeleton__thumb {
  flex: 0 0 38px;
  height: 52px;
  border-radius: 3px;
}

.app-skeleton__line,
.app-skeleton__media,
.app-skeleton__hero,
.app-skeleton__preview,
.app-skeleton__thumb,
.app-skeleton__chart {
  background: rgb(var(--v-theme-surface-light));
}

.app-skeleton__line {
  width: 72%;
  height: 10px;
  border-radius: 3px;
}

.app-skeleton__line--wide {
  width: min(88%, 520px);
}

.app-skeleton__line--short {
  width: min(42%, 240px);
}

.app-skeleton__chart {
  height: 220px;
  margin-top: 12px;
  border-radius: 4px;
}

.app-skeleton__pulse {
  animation: app-skeleton-pulse 1.2s ease-in-out infinite alternate;
}

.app-skeleton__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@keyframes app-skeleton-pulse {
  from {
    opacity: 0.42;
  }

  to {
    opacity: 0.82;
  }
}

@media (width <= 599px) {
  .app-skeleton__detail-grid {
    grid-template-columns: 1fr;
  }

  .app-skeleton__preview {
    width: min(220px, 100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-skeleton__pulse {
    animation: none;
  }
}
</style>
