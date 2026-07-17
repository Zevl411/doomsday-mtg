<template>
  <v-row justify="center">
    <v-col cols="12" sm="8" md="5">
      <v-card border color="surface" rounded="lg">
        <v-card-title class="px-6 pt-6">Sync your decks</v-card-title>
        <v-card-text class="px-6">
          <p class="mb-4 text-medium-emphasis">
            Sign in to sync decks across devices. Guest deck building remains
            available without an account.
          </p>
          <v-text-field v-model="email" autocomplete="email" label="Email" />
          <v-text-field
            v-model="password"
            autocomplete="current-password"
            label="Password"
            type="password"
            @keyup.enter="submit(false)"
          />
          <v-alert v-if="auth.errorMessage" type="error" variant="tonal">
            {{ auth.errorMessage }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="px-6 pb-6">
          <v-btn :to="{ name: 'deck-library' }" variant="text">Cancel</v-btn>
          <v-spacer />
          <v-btn :loading="auth.loading" variant="outlined" @click="submit(true)">
            Register
          </v-btn>
          <v-btn color="primary" :loading="auth.loading" @click="submit(false)">
            Sign In
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const email = ref('')
const password = ref('')

async function submit(register: boolean) {
  const succeeded = register
    ? await auth.register(email.value.trim(), password.value)
    : await auth.signIn(email.value.trim(), password.value)
  if (succeeded) await router.push({ name: 'deck-library' })
}
</script>
