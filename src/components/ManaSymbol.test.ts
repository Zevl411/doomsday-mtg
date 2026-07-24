import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ManaSymbol from './ManaSymbol.vue';

describe('ManaSymbol', () => {
  it('renders a typed mana-font class with an accessible label', () => {
    const wrapper = mount(ManaSymbol, {
      props: { symbol: 'U', size: 'large' },
    });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['ms', 'ms-u', 'ms-cost', 'mana-symbol--large']),
    );
    expect(wrapper.attributes('aria-label')).toBe('Blue mana');
    expect(wrapper.attributes('role')).toBe('img');
  });

  it('marks symbols as hidden when a parent supplies the group label', () => {
    const wrapper = mount(ManaSymbol, {
      props: { symbol: 'W', decorative: true },
    });

    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('aria-label')).toBeUndefined();
  });

  it.each([
    ['G/P', 'ms-gp'],
    ['R/G', 'ms-rg'],
    ['2/U', 'ms-2u'],
  ])('normalizes %s into its mana-font class', (symbol, expectedClass) => {
    const wrapper = mount(ManaSymbol, {
      props: { symbol },
    });

    expect(wrapper.classes()).toContain(expectedClass);
    expect(wrapper.classes()).not.toContain('ms-c');
    expect(wrapper.attributes('aria-label')).toBe(`${symbol} mana`);
  });
});
