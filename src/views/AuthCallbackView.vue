<template>
  <div v-if="!callbackFailed" class="text-center py-12">
    <AppLoadingSkeleton class="mx-auto" :count="2" label="Finishing sign in" variant="compact" />
    <p class="mt-4">Finishing sign in…</p>
  </div>
  <v-alert v-else class="mx-auto my-12" max-width="560" type="error" variant="tonal">
    Sign-in could not be completed. The link may have expired.
    <template #append>
      <v-btn :to="{ name: 'auth' }" variant="outlined">Try again</v-btn>
    </template>
  </v-alert>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useRouter } from 'vue-router';

import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const callbackFailed = ref(false);

onMounted(async () => {
  try {
    await auth.initialize();
    if (!auth.isSignedIn) {
      callbackFailed.value = true;
      return;
    }
    await router.replace({ name: 'deck-library' });
  } catch {
    callbackFailed.value = true;
  }
});
</script>
