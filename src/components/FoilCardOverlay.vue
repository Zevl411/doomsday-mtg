<template>
  <span aria-hidden="true" class="foil-card-overlay" />
</template>

<style scoped>
.foil-card-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    118deg,
    transparent 10%,
    rgb(91 225 255 / 24%) 25%,
    rgb(255 111 229 / 42%) 42%,
    rgb(255 237 126 / 32%) 57%,
    rgb(111 255 201 / 36%) 72%,
    transparent 90%
  );
  background-position: 0% 40%;
  background-size: 220% 220%;
  mix-blend-mode: screen;
  opacity: 0.68;
  filter: saturate(1.25);
}

.foil-card-overlay::after {
  position: absolute;
  inset: 0;
  content: '';
  background: radial-gradient(circle at 72% 18%, rgb(255 255 255 / 52%), transparent 28%);
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
  :global(.card-preview-image:focus-within) > .foil-card-overlay,
  :global(.commander-image:hover) > .foil-card-overlay,
  :global(.commander-image:focus-within) > .foil-card-overlay {
    animation: foil-card-shimmer 950ms ease-out both;
  }
}
</style>
