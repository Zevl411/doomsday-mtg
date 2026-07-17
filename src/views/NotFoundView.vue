<template>
  <v-row justify="center">
    <v-col cols="12" md="8" lg="6">
      <v-card
        border
        class="pa-6 text-center"
        color="surface"
        rounded="lg"
        variant="flat"
      >
        <p class="text-overline text-secondary">404</p>
        <h1 class="text-h4">Page not found</h1>
        <p class="mt-3 text-body-1 text-medium-emphasis">
          The page you requested does not exist.
        </p>
        <div class="d-flex flex-wrap justify-center ga-3 mt-6">
          <v-btn color="primary" :to="{ name: 'home' }" variant="flat">
            Go Home
          </v-btn>
          <v-btn
            color="secondary"
            :to="{ name: 'deck-builder' }"
            variant="outlined"
          >
            Open Deck Builder
          </v-btn>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>
