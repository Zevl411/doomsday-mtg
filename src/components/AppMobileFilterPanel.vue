<template>
  <details class="app-mobile-filter-panel">
    <summary class="app-mobile-filter-panel__summary">
      <span>{{ title }}</span>
      <svg
        aria-hidden="true"
        class="app-mobile-filter-panel__chevron"
        viewBox="0 0 24 24"
      >
        <path d="m7 10 5 5 5-5" />
      </svg>
    </summary>
    <div class="app-mobile-filter-panel__content">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
/**
 * Filter controls stay visible on larger screens but collapse into a native,
 * keyboard-accessible disclosure on phones. Native details elements begin
 * closed without extra breakpoint state or JavaScript.
 */
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Filters',
})
</script>

<style scoped>
.app-mobile-filter-panel__summary {
  display: none;
}

@media (min-width: 600px) {
  /* The closed state is mobile-only; desktop preserves the existing cards. */
  .app-mobile-filter-panel__content {
    display: block;
  }
}

@media (max-width: 599px) {
  .app-mobile-filter-panel__summary {
    align-items: center;
    cursor: pointer;
    display: flex;
    font-size: 1rem;
    font-weight: 600;
    justify-content: space-between;
    list-style: none;
    min-height: 44px;
    padding: 2px 0;
  }

  .app-mobile-filter-panel__summary::-webkit-details-marker {
    display: none;
  }

  .app-mobile-filter-panel__chevron {
    fill: none;
    height: 24px;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
    transition: transform 150ms ease;
    width: 24px;
  }

  .app-mobile-filter-panel[open] .app-mobile-filter-panel__chevron {
    transform: rotate(180deg);
  }

  .app-mobile-filter-panel__content {
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding-top: 12px;
  }
}
</style>
