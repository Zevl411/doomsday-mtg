<template>
  <v-app>
    <v-app-bar border="b" color="surface" flat height="76">
      <v-container class="d-flex align-center mx-auto px-4 px-sm-6">
        <v-app-bar-title>
          <span class="text-h5 font-weight-bold text-primary">
            DoomsdayMTG
          </span>
          <span class="d-block text-caption text-medium-emphasis">
            Competitive Commander Deck Builder
          </span>
        </v-app-bar-title>
      </v-container>
    </v-app-bar>

    <v-main>
      <v-container class="content-container py-6 py-md-8" fluid>
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
