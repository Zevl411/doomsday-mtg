import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // Hash history keeps GitHub Pages refreshes from requesting missing files.
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      // Route-level components are called views. Lazy loading downloads each
      // view only when a user first visits its route.
      component: () => import('./HomeView.vue'),
    },
    {
      path: '/deck-builder',
      name: 'deck-builder',
      component: () => import('./DeckBuilderView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./NotFoundView.vue'),
    },
  ],
})

export default router
