function configuredValue(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

/**
 * Public product branding belongs here so a fork can be renamed without
 * editing Vue components. VITE_ values are bundled into the public frontend,
 * so this configuration must never contain secrets.
 */
export const appConfig = {
  name: configuredValue(import.meta.env.VITE_APP_NAME, 'DoomsdayMTG'),
  tagline: configuredValue(import.meta.env.VITE_APP_TAGLINE, 'Competitive Commander Deck Builder'),
};
