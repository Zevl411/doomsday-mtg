import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import vuetify from '../plugins/vuetify';

import DoubleFacedCardImage from './DoubleFacedCardImage.vue';

import type { ScryfallCard } from '../types/card';

const doubleFacedCard: ScryfallCard = {
  id: 'dfc',
  name: 'Front // Back',
  type_line: 'Creature // Land',
  color_identity: ['G'],
  card_faces: [
    {
      name: 'Front',
      type_line: 'Creature',
      image_uris: {
        small: 'https://example.com/front-small.jpg',
        normal: 'https://example.com/front.jpg',
        large: 'https://example.com/front-large.jpg',
      },
    },
    {
      name: 'Back',
      type_line: 'Land',
      image_uris: {
        small: 'https://example.com/back-small.jpg',
        normal: 'https://example.com/back.jpg',
        large: 'https://example.com/back-large.jpg',
      },
    },
  ],
};

describe('DoubleFacedCardImage', () => {
  it('shows the back face while hovered or focused', async () => {
    const wrapper = mount(DoubleFacedCardImage, {
      props: { card: doubleFacedCard },
      global: { plugins: [vuetify] },
    });
    const image = wrapper.get('.v-img');

    expect(image.classes()).toContain('full-card-image');
    expect(wrapper.html()).toContain('front.jpg');
    await image.trigger('mouseenter');
    expect(wrapper.html()).toContain('back.jpg');
    await image.trigger('mouseleave');
    expect(wrapper.html()).toContain('front.jpg');
    await image.trigger('focus');
    expect(wrapper.html()).toContain('back.jpg');
    await image.trigger('blur');
    expect(wrapper.html()).toContain('front.jpg');
  });
});
