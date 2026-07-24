import { createRouter, createWebHashHistory } from 'vue-router';

import { dataHealthRepository } from '../repositories/dataHealthRepository';

// Router configuration belongs separately from the route-level view components.
const router = createRouter({
  // Hash history keeps GitHub Pages refreshes from requesting missing files.
  // Supplying Vite's base explicitly keeps navbar links inside the repository
  // subdirectory instead of relying on the browser to infer it at runtime.
  history: createWebHashHistory(import.meta.env.BASE_URL),
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
      path: '/decks/public',
      name: 'public-decks',
      component: () => import('../views/PublicDecksView.vue'),
    },
    {
      path: '/decks/shared/:deckId',
      name: 'shared-deck',
      component: () => import('../views/SharedDeckView.vue'),
    },
    {
      path: '/deck-builder',
      redirect: { name: 'deck-library' },
    },
    {
      path: '/decks/:deckId/compare',
      name: 'deck-comparison',
      component: () => import('../views/DeckComparisonView.vue'),
    },
    {
      path: '/decks/:deckId',
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
      path: '/associations',
      name: 'card-associations',
      component: () => import('../views/CardAssociationsView.vue'),
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
      path: '/tournament-decks/:deckId',
      name: 'tournament-deck-detail',
      component: () => import('../views/TournamentDeckDetailView.vue'),
    },
    {
      path: '/admin/ingestion',
      name: 'admin-ingestion',
      component: () => import('../views/AdminIngestionView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/data-health',
      name: 'admin-data-health',
      component: () => import('../views/DataHealthView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
});

// Database RPCs remain the authorization boundary; this guard also prevents
// non-admin users from entering an operational route in the first place.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true;
  return (await dataHealthRepository.isCurrentUserAdmin()) ? true : { name: 'auth' };
});

export default router;
