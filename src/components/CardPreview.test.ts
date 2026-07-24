import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { createEmptyDeck } from '../models/createDeck';
import vuetify from '../plugins/vuetify';

import CardPreview from './CardPreview.vue';

import type { ScryfallCard } from '../types/card';

function mountPreview(card: ScryfallCard | null, foil = false) {
  return mount(CardPreview, {
    props: { card, foil },
    global: {
      plugins: [createPinia(), vuetify],
    },
  });
}

describe('CardPreview', () => {
  it('renders the empty placeholder', () => {
    const wrapper = mountPreview(null);

    expect(wrapper.find('.widget-header-bar').text()).toBe('Card Preview');
    expect(wrapper.text()).toContain('Hover over a search result');
    wrapper.unmount();
  });

  it('renders the empty state for a deck without a commander', () => {
    const deck = createEmptyDeck('Commanderless Deck');
    const wrapper = mountPreview(deck.commander);

    expect(deck.commander).toBeNull();
    expect(wrapper.text()).toContain('Hover over a search result or deck card to inspect it.');
    expect(wrapper.find('img').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders a single-faced card and its preferred image', () => {
    const card: ScryfallCard = {
      id: 'card-printing',
      name: 'Test Card',
      mana_cost: '{2}{U}',
      type_line: 'Artifact',
      oracle_text: '{T}: Add {U}.\nDraw a card.',
      color_identity: ['U'],
      image_uris: {
        small: 'https://example.com/small.jpg',
        normal: 'https://example.com/normal.jpg',
        large: 'https://example.com/large.jpg',
      },
    };
    const wrapper = mountPreview(card);

    expect(wrapper.text()).toContain('Test Card');
    expect(wrapper.text()).toContain('Add');
    const oracleLines = wrapper.findAll('.oracle-text__line');
    expect(oracleLines).toHaveLength(2);
    expect(oracleLines[0]?.text()).toContain(': Add .');
    expect(oracleLines[1]?.text()).toBe('Draw a card.');
    expect(wrapper.html()).toContain('https://example.com/large.jpg');
    expect(wrapper.find('.mana-cost').exists()).toBe(true);
    expect(wrapper.find('.ms-u').exists()).toBe(true);
    expect(wrapper.find('.ms-tap').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('{2}{U}');
    expect(wrapper.text()).not.toContain('{T}');
    expect(wrapper.text()).not.toContain('Color identity');
    wrapper.unmount();
  });

  it('renders useful information for each card face', () => {
    const card: ScryfallCard = {
      id: 'multi-face-printing',
      name: 'Front // Back',
      type_line: 'Instant // Sorcery',
      color_identity: ['U'],
      card_faces: [
        {
          name: 'Front',
          mana_cost: '{U}',
          type_line: 'Instant',
          oracle_text: 'Front rules.\nFront reminder.',
        },
        {
          name: 'Back',
          type_line: 'Sorcery',
          oracle_text: 'Back rules.',
        },
      ],
    };
    const wrapper = mountPreview(card);

    expect(wrapper.text()).toContain('Front rules.');
    expect(wrapper.text()).toContain('Back rules.');
    expect(wrapper.find('.ms-u').exists()).toBe(true);
    expect(wrapper.findAll('.oracle-text')).toHaveLength(2);
    wrapper.unmount();
  });

  it('does not crash when optional fields are missing', () => {
    const card: ScryfallCard = {
      id: 'minimal-printing',
      name: 'Minimal Card',
      type_line: 'Land',
      color_identity: [],
    };

    expect(() => mountPreview(card)).not.toThrow();
  });

  it('keeps mana symbols grouped beside a long card type', () => {
    const wrapper = mountPreview({
      id: 'long-type-printing',
      name: 'Long Type Card',
      mana_cost: '{2}{W}{U}{B}',
      type_line: 'Legendary Artifact Enchantment Creature — Phyrexian Construct',
      color_identity: ['W', 'U', 'B'],
    });

    expect(wrapper.get('.card-preview-copy').text()).toContain(
      'Legendary Artifact Enchantment Creature',
    );
    expect(wrapper.get('.mana-cost').findAll('.ms')).toHaveLength(4);
    wrapper.unmount();
  });

  it('overlays the preview when the selected Deck entry is foil', () => {
    const wrapper = mountPreview(
      {
        id: 'foil-printing',
        name: 'Foil Card',
        type_line: 'Artifact',
        color_identity: [],
        image_uris: {
          small: 'small.jpg',
          normal: 'normal.jpg',
          large: 'large.jpg',
        },
      },
      true,
    );

    expect(wrapper.find('.foil-card-overlay').exists()).toBe(true);
  });

  it('shows printing-specific TCGplayer prices and purchase link', () => {
    const wrapper = mountPreview(
      {
        id: 'priced-printing',
        name: 'Priced Card',
        type_line: 'Artifact',
        color_identity: [],
        prices: {
          usd: '1.25',
          usd_foil: '4.50',
          usd_etched: null,
        },
        purchase_uris: {
          tcgplayer: 'https://www.tcgplayer.com/product/12345',
        },
      },
      true,
    );

    expect(wrapper.text()).toContain('TCGplayer prices');
    expect(wrapper.text()).toContain('Regular');
    expect(wrapper.text()).toContain('$1.25');
    expect(wrapper.text()).toContain('Foil');
    expect(wrapper.text()).toContain('$4.50');
    expect(wrapper.get('a[href*="tcgplayer.com"]').attributes('target')).toBe('_blank');
    expect(wrapper.get('.card-preview-price--selected').text()).toContain('Foil');
    wrapper.unmount();
  });
});
