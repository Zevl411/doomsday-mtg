import { createRouter, createWebHashHistory } from 'vue-router'

// Router configuration belongs separately from the route-level view components.
const router = createRouter({
  // Hash history keeps GitHub Pages refreshes from requesting missing files.
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      // Route-level components are called views. Lazy loading downloads each
      // view only when a user first visits its route.
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('../views/AuthView.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('../views/AuthCallbackView.vue'),
    },
    {
      path: '/decks',
      name: 'deck-library',
      component: () => import('../views/DeckLibraryView.vue'),
    },
    {
      path: '/deck-builder',
      name: 'deck-builder',
      component: () => import('../views/DeckBuilderView.vue'),
    },
    {
      path: '/metagame',
      name: 'metagame',
      component: () => import('../views/MetagameView.vue'),
    },
    {
      path: '/commanders/:commanderKey',
      name: 'commander-metagame',
      component: () => import('../views/CommanderMetagameView.vue'),
    },
    {
      path: '/tournaments',
      name: 'tournaments',
      component: () => import('../views/TournamentsView.vue'),
    },
    {
      path: '/regions',
      name: 'regions',
      component: () => import('../views/RegionalMetagameView.vue'),
    },
    {
      path: '/tournaments/:tournamentId',
      name: 'tournament-detail',
      component: () => import('../views/TournamentDetailView.vue'),
    },
    {
      path: '/admin/ingestion',
      name: 'admin-ingestion',
      component: () => import('../views/AdminIngestionView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

export default router
