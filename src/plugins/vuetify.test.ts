import { defineComponent, h } from 'vue';

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { VApp, VBtn, VCheckbox, VSelect } from 'vuetify/components';

import vuetify from './vuetify';

const IconHarness = defineComponent({
  setup() {
    return () =>
      h(VApp, null, {
        default: () => [
          h(VCheckbox, {
            'data-testid': 'checkbox',
            label: 'Visible',
          }),
          h(VSelect, {
            'data-testid': 'select',
            items: ['One', 'Two'],
            label: 'Choice',
          }),
          h(
            VBtn,
            {
              'data-testid': 'refresh',
              prependIcon: '$refresh',
            },
            {
              default: () => 'Reload',
            },
          ),
        ],
      });
  },
});

describe('Vuetify icon configuration', () => {
  it('renders framework and app icons as inline SVG without an icon font', () => {
    const wrapper = mount(IconHarness, {
      global: { plugins: [vuetify] },
    });

    expect(wrapper.get('[data-testid="checkbox"]').find('svg.v-icon__svg').exists()).toBe(true);
    expect(wrapper.get('[data-testid="select"]').find('svg.v-icon__svg').exists()).toBe(true);
    expect(wrapper.get('[data-testid="refresh"]').find('svg.v-icon__svg').exists()).toBe(true);
  });
});
