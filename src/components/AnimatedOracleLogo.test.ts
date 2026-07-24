import { ref } from 'vue';

import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('vuetify', () => ({
  useDisplay: () => ({ xs: ref(true) }),
}));

import AnimatedOracleLogo from './AnimatedOracleLogo.vue';

describe('AnimatedOracleLogo', () => {
  it('does not create animation media at the phone breakpoint', () => {
    const wrapper = mount(AnimatedOracleLogo, {
      props: { intervalSeconds: 30 },
    });

    expect(wrapper.find('video').exists()).toBe(false);
    expect(wrapper.find('picture').exists()).toBe(false);
    expect(wrapper.get('.animated-oracle-logo__static').isVisible()).toBe(true);
  });
});
