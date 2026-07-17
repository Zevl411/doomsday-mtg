<template>
  <v-row justify="center">
    <v-col cols="12" md="8" lg="6">
      <v-card border color="surface" rounded="lg" variant="flat">
        <v-card-title class="px-6 pt-6 text-h4 text-wrap">
          DoomsdayMTG
        </v-card-title>
        <v-card-text class="px-6 text-body-1 text-medium-emphasis">
          Build and validate competitive Commander decks with Scryfall-powered
          card search.
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-btn color="primary" :to="{ name: 'deck-builder' }" variant="flat">
            Open Deck Builder
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>
