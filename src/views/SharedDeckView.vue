<template>
  <AppLoadingSkeleton v-if="loading" label="Loading shared Deck" variant="detail" />
  <v-alert v-else-if="error" type="error" variant="tonal">{{ error }}</v-alert>
  <div v-else-if="deck" class="shared-deck-page">
    <v-card border class="shared-deck-header" color="surface-bright" rounded="lg" variant="flat">
      <v-card-text class="shared-deck-header__content pa-3">
        <div class="shared-deck-header__summary">
          <div class="d-flex flex-wrap align-center ga-2">
            <h1 class="text-h4 font-weight-bold">{{ deck.name }}</h1>
            <span class="text-h5 text-medium-emphasis">|</span>
            <ColorIdentitySymbols :colors="deckColorIdentity" size="medium" />
          </div>
          <div class="d-flex flex-wrap align-center ga-2 mt-1">
            <p class="text-caption text-medium-emphasis">
              Created by {{ deck.creatorUsername ?? 'Unknown' }}
            </p>
            <v-chip size="small" variant="outlined">
              {{ deck.visibility ?? 'public' }}
            </v-chip>
            <v-chip size="small" variant="outlined"> Read only </v-chip>
          </div>
          <v-sheet
            v-if="deck.description"
            border
            class="mt-2 pa-2 text-body-2"
            color="transparent"
            rounded="lg"
          >
            {{ deck.description }}
          </v-sheet>
        </div>
        <div class="shared-deck-header__actions">
          <v-btn color="primary" variant="outlined" @click="copyDeck">
            <DeckActionIcon name="duplicate" />
            Duplicate
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <div class="shared-deck-workspace">
      <div
        class="workspace-commander d-flex"
        :class="{ 'workspace-commander--paired': showPartnerPanel }"
        :style="commanderPanelStyle"
      >
        <div class="workspace-commander-slot">
          <CommanderPanel :compact-display="showPartnerPanel" :deck="deck" display-only read-only />
        </div>
        <div v-if="showPartnerPanel" class="workspace-commander-slot">
          <CommanderPanel
            compact-display
            :deck="deck"
            display-only
            display-target="partner"
            read-only
          />
        </div>
      </div>

      <div class="workspace-recommendations d-flex">
        <DeckRecommendationsPanel
          :deck="deck"
          read-only
          @content-resized="recommendationContentHeight = $event"
        />
      </div>

      <div class="workspace-deck">
        <DeckPanel :deck="deck" read-only />
      </div>

      <div class="workspace-statistics d-flex">
        <DeckStatisticsPanel :deck="deck" />
      </div>

      <div class="workspace-preview">
        <CardPreview :card="store.previewCard" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';

import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue';
import CardPreview from '../components/CardPreview.vue';
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue';
import CommanderPanel from '../components/CommanderPanel.vue';
import DeckActionIcon from '../components/DeckActionIcon.vue';
import DeckPanel from '../components/DeckPanel.vue';
import DeckRecommendationsPanel from '../components/DeckRecommendationsPanel.vue';
import DeckStatisticsPanel from '../components/DeckStatisticsPanel.vue';
import { sharedDeckRepository } from '../repositories/sharedDeckRepository';
import { useAuthStore } from '../stores/auth';
import { useDeckStore } from '../stores/deck';

import type { Deck } from '../models/deck';

const route = useRoute();
const router = useRouter();
const display = useDisplay();
const store = useDeckStore();
const auth = useAuthStore();
const deck = ref<Deck | null>(null);
const loading = ref(true);
const error = ref('');
const recommendationContentHeight = ref(0);
const previousPreviewState = {
  previewCard: store.previewCard,
  selectedPreviewCard: store.selectedPreviewCard,
  lastPreviewCard: store.lastPreviewCard,
};
const deckColorIdentity = computed(() => [
  ...new Set([
    ...(deck.value?.commander?.color_identity ?? []),
    ...(deck.value?.partnerCommander?.color_identity ?? []),
  ]),
]);
const showPartnerPanel = computed(() => Boolean(deck.value?.partnerCommander));
const commanderPanelStyle = computed(() =>
  display.lgAndUp.value && recommendationContentHeight.value > 0
    ? { height: `${recommendationContentHeight.value}px` }
    : undefined,
);

onMounted(async () => {
  try {
    deck.value = await sharedDeckRepository.getAccessible(String(route.params.deckId));
    if (!deck.value) {
      error.value = 'This deck is private or does not exist.';
      return;
    }

    // Shared Decks are never inserted into the viewer's library. Preview state
    // is temporarily pointed at the public Deck and restored when leaving.
    store.selectedPreviewCard = null;
    store.lastPreviewCard = deck.value.commander;
    store.previewCard = deck.value.commander;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load deck.';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  store.previewCard = previousPreviewState.previewCard;
  store.selectedPreviewCard = previousPreviewState.selectedPreviewCard;
  store.lastPreviewCard = previousPreviewState.lastPreviewCard;
});

function copyDeck() {
  if (!deck.value) return;
  const copy = store.copyExternalDeck(
    deck.value,
    `${deck.value.name} (copied from ${deck.value.creatorUsername ?? 'Unknown'})`,
    'unlisted',
    auth.username,
  );
  void router.push({
    name: 'deck-builder',
    params: { deckId: copy.id },
  });
}
</script>

<style scoped>
.shared-deck-header {
  position: relative;
  z-index: 100;
  overflow: visible;
}

.shared-deck-header__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 24px;
}

.shared-deck-header__summary {
  min-width: 0;
}

.shared-deck-header__actions {
  display: flex;
  align-items: start;
  justify-content: end;
}

.workspace-commander {
  position: relative;
  z-index: 40;
  align-self: end;
  min-width: 0;
}

.workspace-commander--paired {
  flex-direction: column;
  gap: 16px;
}

.workspace-commander-slot {
  display: flex;
  width: 100%;
  min-height: 0;
}

@media (width >= 1280px) {
  .shared-deck-workspace {
    display: grid;
    grid-template-columns: 3fr 3fr 6fr;
    gap: 16px;
    margin-top: 16px;
  }

  .workspace-preview {
    position: sticky;
    top: 100px;
    grid-row: 1 / span 2;
    grid-column: 1;
    align-self: start;
    max-height: calc(100vh - 116px);
    overflow-y: auto;
  }

  .workspace-commander {
    grid-row: 1;
    grid-column: 2;
  }

  .workspace-commander--paired .workspace-commander-slot {
    flex: 1 1 0;
  }

  .workspace-recommendations {
    grid-row: 1;
    grid-column: 3;
    min-width: 0;
  }

  .workspace-deck {
    grid-row: 2;
    grid-column: 2 / 4;
  }

  .workspace-statistics {
    grid-row: 3;
    grid-column: 2 / 4;
    min-width: 0;
  }
}

@media (width <= 1279px) {
  .shared-deck-workspace {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
  }

  .workspace-deck {
    order: 2;
  }

  .workspace-statistics {
    order: 3;
  }

  .workspace-preview {
    order: 4;
  }
}

@media (width <= 599px) {
  .shared-deck-header__content {
    grid-template-columns: minmax(0, 1fr);
  }

  .shared-deck-header__actions,
  .shared-deck-header__actions :deep(.v-btn) {
    width: 100%;
  }

  .shared-deck-workspace {
    gap: 10px;
    margin-top: 10px;
  }

  .workspace-commander--paired {
    gap: 10px;
  }

  .workspace-commander,
  .workspace-recommendations,
  .workspace-statistics,
  .workspace-deck,
  .workspace-preview {
    width: 100%;
    min-width: 0;
  }
}
</style>
