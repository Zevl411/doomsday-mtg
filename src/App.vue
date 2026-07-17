<script setup lang="ts">
// The <script setup> syntax is Vue's simpler way to write component logic.
// We will add TypeScript variables and functions here as the app grows.
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div>
        <p class="eyebrow">Competitive Commander Deck Builder</p>
        <h1>DoomsdayMTG</h1>
      </div>

      <button class="new-deck-button" type="button">
        New Deck
      </button>
    </header>

    <main class="app-content">
      <section class="welcome-panel">
        <p class="section-label">MVP</p>

        <h2>Build smarter cEDH decks.</h2>

        <p class="welcome-description">
          Search cards, enforce Commander legality, compare competitive
          decklists, and discover meaningful card associations.
        </p>

        <button class="primary-button" type="button">
          Choose a Commander
        </button>
      </section>

      <section class="status-panel">
        <h2>Development roadmap</h2>

        <ul>
          <li>Commander selection</li>
          <li>Scryfall card search</li>
          <li>Deck construction</li>
          <li>Commander legality checks</li>
          <li>Local deck saving</li>
        </ul>
      </section>
    </main>
  </div>
</template>