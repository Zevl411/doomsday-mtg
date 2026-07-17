<template>
  <v-app>
    <v-app-bar border="b" color="surface" flat height="76">
      <v-container class="d-flex align-center mx-auto px-4 px-sm-6">
        <v-app-bar-title>
          <span class="text-h6 text-sm-h5 font-weight-bold text-primary">
            DoomsdayMTG
          </span>
          <span class="d-none d-sm-block text-caption text-medium-emphasis">
            Competitive Commander Deck Builder
          </span>
        </v-app-bar-title>
        <v-spacer />
        <nav class="d-flex ga-1" aria-label="Primary navigation">
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'deck-library' }"
            variant="text"
          >
            Decks
          </v-btn>
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'home' }"
            variant="text"
          >
            Home
          </v-btn>
          <v-btn
            active-color="primary"
            size="small"
            :to="{ name: 'deck-builder' }"
            variant="text"
          >
            <span class="d-none d-sm-inline">Deck Builder</span>
            <span class="d-sm-none">Builder</span>
          </v-btn>
        </nav>
      </v-container>
    </v-app-bar>

    <v-main>
      <v-container class="content-container py-6 py-md-8" fluid>
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
