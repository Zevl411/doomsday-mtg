<template>
  <span aria-hidden="true" class="foil-card-overlay" />
</template>

<style scoped>
.foil-card-overlay {
  background:
    linear-gradient(
      118deg,
      transparent 10%,
      rgba(91, 225, 255, 0.24) 25%,
      rgba(255, 111, 229, 0.42) 42%,
      rgba(255, 237, 126, 0.32) 57%,
      rgba(111, 255, 201, 0.36) 72%,
      transparent 90%
    );
  background-size: 220% 220%;
  background-position: 0% 40%;
  filter: saturate(1.25);
  inset: 0;
  mix-blend-mode: screen;
  opacity: 0.68;
  pointer-events: none;
  position: absolute;
  z-index: 1;
}

.foil-card-overlay::after {
  background:
    radial-gradient(
      circle at 72% 18%,
      rgba(255, 255, 255, 0.52),
      transparent 28%
    );
  content: '';
  inset: 0;
  position: absolute;
}

@keyframes foil-card-shimmer {
  0% {
    background-position: 0% 40%;
    opacity: 0.68;
  }

  48% {
    opacity: 0.96;
  }

  100% {
    background-position: 100% 60%;
    opacity: 0.74;
  }
}

@media (prefers-reduced-motion: no-preference) {
  :global(.deck-grid-card:hover) > .foil-card-overlay,
  :global(.deck-grid-card:focus-visible) > .foil-card-overlay,
  :global(.card-preview-image:hover) > .foil-card-overlay,
  :global(.card-preview-image:focus-within) > .foil-card-overlay {
    animation: foil-card-shimmer 950ms ease-out both;
  }
}
</style>
