<template>
  <svg
    aria-hidden="true"
    class="deck-action-icon"
    :class="{ 'deck-action-icon--compact': compact }"
    viewBox="0 0 24 24"
  >
    <path :d="paths[name]" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  compact?: boolean
  name:
    | 'settings'
    | 'compare'
    | 'copy'
    | 'duplicate'
    | 'rename'
    | 'import'
    | 'export'
    | 'decrease'
    | 'increase'
    | 'move'
    | 'printing'
    | 'foil'
    | 'delete'
    | 'close'
}>()

const paths = {
  settings:
    'M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3.3h-4L10.7 6A7.7 7.7 0 0 0 9 7L6.5 6l-2 3.4L6.6 11a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2.1 1.6 2 3.4L9 17a7.7 7.7 0 0 0 1.7 1l.3 2.7h4l.3-2.7a7.7 7.7 0 0 0 1.7-1l2.5 1 2-3.4L19.4 13ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z',
  compare:
    'M4 19h16v2H2V3h2v16Zm3-2H5v-5h2v5Zm4 0H9V7h2v10Zm4 0h-2V9h2v8Zm4 0h-2V4h2v13Z',
  copy:
    'M8 8h11v11H8V8Zm2 2v7h7v-7h-7ZM5 5h10v2H7v8H5V5Z',
  duplicate:
    'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z',
  rename:
    'm3 17.25 10.6-10.6 3.75 3.75L6.75 21H3v-3.75ZM18.7 9.05 14.95 5.3l1.85-1.85a1.5 1.5 0 0 1 2.1 0l1.65 1.65a1.5 1.5 0 0 1 0 2.1L18.7 9.05Z',
  import:
    'M11 3h2v10l3.5-3.5 1.4 1.4-5.9 5.9-5.9-5.9 1.4-1.4L11 13V3ZM4 18h16v3H4v-3Z',
  export:
    'M11 16h2V6l3.5 3.5 1.4-1.4L12 2.2 6.1 8.1l1.4 1.4L11 6v10ZM4 18h16v3H4v-3Z',
  decrease: 'M5 11h14v2H5v-2Z',
  increase: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
  move: 'M7 7h9l-3-3 1.4-1.4L19.8 8l-5.4 5.4L13 12l3-3H7V7Zm10 10H8l3 3-1.4 1.4L4.2 16l5.4-5.4L11 12l-3 3h9v2Z',
  printing:
    'M6 2h12a2 2 0 0 1 2 2v12h-2V4H6V2Zm-2 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v12h11V8H4Zm2 2h7v2H6v-2Zm0 4h7v2H6v-2Z',
  foil:
    'm12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Zm6 11 1 2.8 3 1.2-3 1.2L18 21l-1-2.8-3-1.2 3-1.2 1-2.8ZM6 14l.8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14Z',
  delete:
    'M9 3h6l1 2h4v2h-1l-1 14H6L5 7H4V5h4l1-2Zm-2 4 1 12h8l1-12H7Zm3 2h2v8h-2V9Zm4 0h2v8h-2V9Z',
  close:
    'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z',
}
</script>

<style scoped>
.deck-action-icon {
  fill: currentColor;
  height: 18px;
  margin-right: 6px;
  width: 18px;
}

.deck-action-icon--compact {
  margin-right: 0;
}
</style>
