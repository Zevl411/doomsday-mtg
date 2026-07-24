import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyDeck } from '../models/createDeck';
import vuetify from '../plugins/vuetify';
import { memoryDeckRepository } from '../repositories/localDeckRepository';
import { useDeckStore } from '../stores/deck';

import DeckCreationDialog from './DeckCreationDialog.vue';

import type { ScryfallCard } from '../types/card';

const { prepareDeckImport } = vi.hoisted(() => ({
  prepareDeckImport: vi.fn(),
}));

vi.mock('../services/deckImport', () => ({ prepareDeckImport }));

const commander: ScryfallCard = {
  id: 'commander',
  name: 'Sisay, Weatherlight Captain',
  type_line: 'Legendary Creature — Human Soldier',
  color_identity: ['W'],
};

beforeEach(() => {
  setActivePinia(createPinia());
  prepareDeckImport.mockReset();
  useDeckStore().useRepository(memoryDeckRepository, 'cloud', {
    version: 1,
    decks: [],
    activeDeckId: null,
  });
});

describe('DeckCreationDialog', () => {
  it('creates nothing until the dialog is submitted', () => {
    mount(DeckCreationDialog, {
      props: { modelValue: true },
      global: {
        plugins: [vuetify],
        stubs: {
          CardSearch: true,
          VDialog: { template: '<div><slot /></div>' },
        },
      },
    });

    expect(useDeckStore().decks).toEqual([]);
  });

  it('creates an Untitled Deck when every field is left empty', async () => {
    const wrapper = mount(DeckCreationDialog, {
      props: { modelValue: true },
      global: {
        plugins: [vuetify],
        stubs: {
          CardSearch: true,
          VDialog: { template: '<div><slot /></div>' },
        },
      },
    });

    await wrapper
      .findAll('.v-btn')
      .find((button) => button.text().includes('Create deck'))
      ?.trigger('click');
    await flushPromises();

    expect(useDeckStore().activeDeck?.name).toBe('Untitled Deck');
    expect(useDeckStore().activeDeck?.description).toBe('');
    expect(useDeckStore().activeDeck?.visibility).toBe('public');
    expect(useDeckStore().activeDeck?.commander).toBeNull();
    expect(prepareDeckImport).not.toHaveBeenCalled();
  });

  it('uses an imported Commander when none was selected in the form', async () => {
    const imported = createEmptyDeck('Imported');
    imported.commander = commander;
    prepareDeckImport.mockResolvedValue({
      deck: imported,
      result: {
        format: 'generic',
        importedCards: 1,
        skippedCards: 0,
        issues: [],
        informationalIssues: [],
        ignoredSections: [],
        commanderSource: 'imported',
      },
    });

    const wrapper = mount(DeckCreationDialog, {
      props: { modelValue: true },
      global: {
        plugins: [vuetify],
        stubs: {
          CardSearch: true,
          VDialog: { template: '<div><slot /></div>' },
        },
      },
    });
    const textField = wrapper.findComponent({ name: 'VTextField' });
    await textField.setValue('Tournament Copy');
    const textareas = wrapper.findAllComponents({ name: 'VTextarea' });
    await textareas.at(-1)?.setValue('Commander\n1 Sisay, Weatherlight Captain');
    await wrapper
      .findAll('.v-btn')
      .find((button) => button.text().includes('Create deck'))
      ?.trigger('click');
    await flushPromises();

    expect(prepareDeckImport).toHaveBeenCalled();
    expect(useDeckStore().activeDeck?.name).toBe('Tournament Copy');
    expect(useDeckStore().activeDeck?.commander?.name).toBe('Sisay, Weatherlight Captain');
  });
});
