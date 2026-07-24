import { defineStore } from 'pinia';

import { dataHealthRepository } from '../repositories/dataHealthRepository';

let adminCheckPromise: Promise<void> | null = null;

/**
 * Operational messages are useful to administrators but distracting to
 * regular users. This store performs one cached permission check per session.
 */
export const useAdminStore = defineStore('admin', {
  state: () => ({
    userId: null as string | null,
    isAdmin: false,
    initialized: false,
  }),

  actions: {
    async initialize(userId: string | null) {
      if (this.initialized && this.userId === userId) return;
      if (adminCheckPromise) return adminCheckPromise;

      this.userId = userId;
      this.isAdmin = false;
      this.initialized = false;
      adminCheckPromise = (async () => {
        if (userId) {
          this.isAdmin = await dataHealthRepository.isCurrentUserAdmin();
        }
        this.initialized = true;
      })();
      try {
        await adminCheckPromise;
      } finally {
        adminCheckPromise = null;
      }
    },
  },
});
