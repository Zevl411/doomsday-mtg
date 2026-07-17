<template>
  <div class="text-center py-12">
    <v-progress-circular color="primary" indeterminate />
    <p class="mt-4">Finishing sign in…</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

onMounted(async () => {
  await auth.initialize()
  await router.replace({ name: 'deck-library' })
})
</script>
