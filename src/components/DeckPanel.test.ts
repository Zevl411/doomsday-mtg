import { defineComponent } from 'vue';

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { createEmptyDeck } from '../models/createDeck';
import vuetify from '../plugins/vuetify';
import { useDeckStore } from '../stores/deck';

import DeckPanel from './DeckPanel.vue';

import type { ScryfallCard } from '../types/card';

const artifact: ScryfallCard = {
  id: 'artifact',
  name: 'Arcane Signet',
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
  mana_cost: '{2}',
  prices: {
    usd: '2.25',
    usd_foil: '5.50',
  },
  image_uris: {
    small: 'https://example.com/small.jpg',
    normal: 'https://example.com/normal.jpg',
    large: 'https://example.com/large.jpg',
  },
};
const island: ScryfallCard = {
  id: 'island',
  name: 'Island',
  type_line: 'Basic Land — Island',
  color_identity: ['U'],
  cmc: 0,
};

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  useDeckStore().createDeck();
});

function mountPanel() {
  return mount(DeckPanel, { global: { plugins: [vuetify] } });
}

describe('DeckPanel', () => {
  it('renders dedicated boards and merges considering into Maybeboard', () => {
    const store = useDeckStore();
    store.deck.cards = [{ card: artifact, quantity: 1 }];
    store.deck.sideboard = [{ card: island, quantity: 2 }];
    store.deck.considering = [{ card: artifact, quantity: 3 }];
    const wrapper = mountPanel();

    expect(wrapper.findAll('.widget-header-bar')).toHaveLength(3);
    expect(wrapper.text()).toContain('Mainboard (1)');
    expect(wrapper.text()).toContain('Sideboard (2)');
    expect(wrapper.text()).toContain('Maybeboard (3)');
    expect(wrapper.text()).not.toContain('Considering (');
  });

  it('uses compact text-only rows in list view', async () => {
    useDeckStore().deck.cards = [{ card: artifact, quantity: 1 }];
    const wrapper = mountPanel();
    await wrapper.find('[aria-label="List view for Mainboard"]').trigger('click');

    expect(wrapper.find('img[src="https://example.com/small.jpg"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Arcane Signet');
    expect(wrapper.text()).toContain('1× Arcane Signet');
    expect(wrapper.find('.deck-list-price').text()).toBe('$2.25');
  });

  it('toggles grid and group prices from the board header', async () => {
    useDeckStore().deck.cards = [{ card: artifact, quantity: 2 }];
    const wrapper = mountPanel();

    expect(wrapper.find('.deck-grid-price').exists()).toBe(false);
    const toggle = wrapper
      .findAllComponents({ name: 'VSwitch' })
      .find((control) => control.props('label') === 'Show prices');
    toggle?.vm.$emit('update:modelValue', true);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.deck-grid-price').text()).toBe('$4.50');
    expect(wrapper.find('h3').text()).toContain('· $4.50');
    expect(
      JSON.parse(localStorage.getItem('doomsday-mtg-deck-panel-preferences') ?? '{}')
        .showGridPrices,
    ).toBe(true);
  });

  it('offers independent primary and secondary sorting for every board', () => {
    const wrapper = mountPanel();

    expect(wrapper.findAllComponents({ name: 'VSelect' })).toHaveLength(2);
    const thenBy = wrapper.findAllComponents({ name: 'VSelect' })[1];
    expect(thenBy?.props('items')).toContainEqual({
      title: 'None',
      value: 'none',
    });
  });

  it('keeps non-mainboards collapsed until expanded', async () => {
    const store = useDeckStore();
    store.deck.sideboard = [{ card: artifact, quantity: 1 }];
    const wrapper = mountPanel();

    expect(wrapper.find('[aria-label="Remove one Arcane Signet"]').exists()).toBe(false);
    await wrapper.find('[aria-label="Expand Sideboard"]').trigger('click');
    expect(wrapper.find('[aria-label="Remove one Arcane Signet"]').exists()).toBe(false);
    expect(wrapper.findAllComponents({ name: 'VSelect' })).toHaveLength(4);
  });

  it('groups multi-type cards once and keeps the requested type order', () => {
    const store = useDeckStore();
    store.deck.cards = [
      {
        card: {
          ...artifact,
          id: 'legendary-artifact',
          name: 'Legendary Relic',
          type_line: 'Legendary Artifact',
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'double-faced-card',
          name: 'Front Creature // Back Land',
          type_line: 'Artifact // Land',
          card_faces: [
            {
              name: 'Front Creature',
              type_line: 'Legendary Creature — Human',
            },
            {
              name: 'Back Land',
              type_line: 'Land',
            },
          ],
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'artifact-creature',
          name: 'Artifact Creature',
          type_line: 'Artifact Creature — Construct',
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'artifact-land',
          name: 'Artifact Land',
          type_line: 'Artifact Land',
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'planeswalker',
          name: 'Test Planeswalker',
          type_line: 'Legendary Planeswalker — Test',
        },
        quantity: 1,
      },
    ];
    const wrapper = mountPanel();
    const groupLabels = wrapper.findAll('h3').map((heading) => heading.text());

    expect(groupLabels).toEqual(['Planeswalker (1)', 'Creature (2)', 'Artifact (1)', 'Land (1)']);
    expect(groupLabels).not.toContain('Legendary Artifact');
  });

  it('defaults to grid, renders both icons, and switches to list view', async () => {
    useDeckStore().deck.cards = [{ card: artifact, quantity: 1 }];
    const wrapper = mountPanel();

    const gridButton = wrapper.find('[aria-label="Grid view for Mainboard"]');
    const listButton = wrapper.find('[aria-label="List view for Mainboard"]');
    expect(gridButton.find('svg').exists()).toBe(true);
    expect(listButton.find('svg').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('×1');
    expect(wrapper.find('[aria-label="Remove one Arcane Signet"]').exists()).toBe(false);

    await listButton.trigger('click');
    expect(wrapper.find('[aria-label="Remove one Arcane Signet"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Mana cost {2}"]').exists()).toBe(true);
    expect(gridButton.element.compareDocumentPosition(listButton.element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('persists display preferences in browser-local storage', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[aria-label="List view for Mainboard"]').trigger('click');
    wrapper.unmount();

    const saved = JSON.parse(localStorage.getItem('doomsday-mtg-deck-panel-preferences') ?? '{}');
    expect(saved.viewModes.mainboard).toBe('list');
    expect(saved.viewModes.sideboard).toBe('grid');

    const restored = mountPanel();
    expect(restored.find('[aria-label="List view for Mainboard"]').classes()).toContain(
      'v-btn--active',
    );
  });

  it('restores and independently persists stepped grid card sizes', async () => {
    localStorage.setItem(
      'doomsday-mtg-deck-panel-preferences',
      JSON.stringify({
        gridSizes: {
          mainboard: 4,
          sideboard: 2,
          maybeboard: 1,
        },
      }),
    );
    useDeckStore().deck.cards = [{ card: artifact, quantity: 1 }];
    const wrapper = mountPanel();

    expect(wrapper.find('.deck-card-grid').attributes('style')).toContain(
      '--deck-card-min-width: 220px',
    );

    const slider = wrapper.findComponent({ name: 'VSlider' });
    slider.vm.$emit('update:modelValue', 1);
    await wrapper.vm.$nextTick();

    const saved = JSON.parse(localStorage.getItem('doomsday-mtg-deck-panel-preferences') ?? '{}');
    expect(saved.gridSizes.mainboard).toBe(1);
    expect(saved.gridSizes.sideboard).toBe(2);
  });

  it('renders an external Deck without editing controls in read-only mode', () => {
    const externalDeck = createEmptyDeck('Public Deck');
    externalDeck.cards = [{ card: artifact, quantity: 1 }];

    const wrapper = mount(DeckPanel, {
      props: {
        deck: externalDeck,
        readOnly: true,
      },
      global: { plugins: [vuetify] },
    });

    expect(wrapper.text()).toContain('Mainboard (1)');
    expect(wrapper.find('img[alt="Arcane Signet"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Remove Arcane Signet"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Move to');
  });

  it('offers printing selection from the card context menu', async () => {
    useDeckStore().deck.cards = [{ card: artifact, quantity: 1 }];
    const wrapper = mount(DeckPanel, {
      global: {
        plugins: [vuetify],
        stubs: {
          VMenu: defineComponent({
            props: { modelValue: Boolean },
            template: `
              <div>
                <slot name="activator" :props="{}" />
                <div v-if="modelValue"><slot /></div>
              </div>
            `,
          }),
        },
      },
    });

    await wrapper
      .find('img[alt="Arcane Signet"]')
      .trigger('contextmenu', { clientX: 40, clientY: 60 });

    expect(wrapper.text()).toContain('Change printing');
    expect(wrapper.text()).toContain('Make foil');
  });

  it('renders a foil treatment over foil grid cards', () => {
    useDeckStore().deck.cards = [
      {
        card: artifact,
        quantity: 1,
        foil: true,
      },
    ];
    const wrapper = mountPanel();

    expect(wrapper.find('.foil-card-overlay').exists()).toBe(true);
  });
});
