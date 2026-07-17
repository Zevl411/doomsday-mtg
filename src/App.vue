<template>
  <AppLayout>
    <SearchPanel />
    <CommanderPanel />
    <DeckPanel />
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from './components/AppLayout.vue'
import CommanderPanel from './components/CommanderPanel.vue'
import DeckPanel from './components/DeckPanel.vue'
import SearchPanel from './components/SearchPanel.vue'
</script>
