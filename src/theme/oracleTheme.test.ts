import { describe, expect, it } from 'vitest';

import { oracleComponentDefaults } from '../plugins/vuetify';

import { oracleDarkTheme } from './oracleTheme';

describe('Oracle theme', () => {
  it('keeps the approved subdued chrome palette', () => {
    expect(oracleDarkTheme.dark).toBe(true);
    expect(oracleDarkTheme.colors?.background).toBe('#0F0D18');
    expect(oracleDarkTheme.colors?.surface).toBe('#171321');
    expect(oracleDarkTheme.colors?.primary).toBe('#D7A24A');
    expect(oracleDarkTheme.colors?.secondary).toBe('#9462A0');
    expect(oracleDarkTheme.colors?.accent).toBe('#3A183D');
    expect(oracleDarkTheme.colors?.['placement-gold']).toBe('#D4AF37');
    expect(oracleDarkTheme.colors?.['placement-top-cut']).toBe('#587A9B');
  });

  it('uses readable approved colors for code and keyboard hints', () => {
    expect(oracleDarkTheme.variables?.['theme-kbd']).toBe('#21182B');
    expect(oracleDarkTheme.variables?.['theme-on-kbd']).toBe('#F4E6C5');
    expect(oracleDarkTheme.variables?.['theme-code']).toBe('#21182B');
    expect(oracleDarkTheme.variables?.['theme-on-code']).toBe('#F1D39A');
  });

  it('uses restrained, dense defaults for desktop application controls', () => {
    expect(oracleComponentDefaults.VBtn).toMatchObject({
      density: 'compact',
      elevation: 0,
      rounded: 'sm',
    });
    expect(oracleComponentDefaults.VCard).toMatchObject({
      border: true,
      elevation: 0,
      rounded: 'sm',
    });
    expect(oracleComponentDefaults.VTextField.density).toBe('compact');
    expect(oracleComponentDefaults.VSelect.density).toBe('compact');
    expect(oracleComponentDefaults.VTable.density).toBe('compact');
    expect(oracleComponentDefaults.VChip).toMatchObject({
      density: 'comfortable',
      rounded: 'md',
    });
    expect(oracleDarkTheme.variables?.['border-opacity']).toBe(0.36);
  });
});
