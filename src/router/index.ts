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
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

export default router
