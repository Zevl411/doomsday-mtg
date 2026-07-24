<template>
  <details class="app-mobile-filter-panel">
    <summary class="app-mobile-filter-panel__summary">
      <span>{{ title }}</span>
      <svg aria-hidden="true" class="app-mobile-filter-panel__chevron" viewBox="0 0 24 24">
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
withDefaults(
  defineProps<{
    title?: string;
  }>(),
  {
    title: 'Filters',
  },
);
</script>

<style scoped>
.app-mobile-filter-panel__summary {
  display: none;
}

@media (width >= 600px) {
  /* The closed state is mobile-only; desktop preserves the existing cards. */
  .app-mobile-filter-panel__content {
    display: block;
  }
}

@media (width <= 599px) {
  .app-mobile-filter-panel__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 2px 0;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    list-style: none;
  }

  .app-mobile-filter-panel__summary::-webkit-details-marker {
    display: none;
  }

  .app-mobile-filter-panel__chevron {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentcolor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 150ms ease;
  }

  .app-mobile-filter-panel[open] .app-mobile-filter-panel__chevron {
    transform: rotate(180deg);
  }

  .app-mobile-filter-panel__content {
    padding-top: 12px;
    border-top: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
  }
}
</style>
