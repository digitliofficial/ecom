/** Theme packs + design tokens */

export type ThemeTokens = {
  id: string;
  name: string;
  description: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
    border: string;
  };
  fonts: {
    display: string;
    body: string;
  };
};

export const defaultTheme: ThemeTokens = {
  id: 'default',
  name: 'Default',
  description: 'Dark slate shell with cool accent',
  colors: {
    background: '#0f1419',
    foreground: '#f4f6f8',
    accent: '#3d8bfd',
    muted: '#8b9aab',
    border: '#3a4a5c',
  },
  fonts: {
    display: 'Georgia, "Times New Roman", serif',
    body: 'ui-sans-serif, system-ui, sans-serif',
  },
};

export const daylightTheme: ThemeTokens = {
  id: 'daylight',
  name: 'Daylight',
  description: 'Light stone field with forest accent',
  colors: {
    background: '#f3f0e8',
    foreground: '#1c1917',
    accent: '#1f6f54',
    muted: '#78716c',
    border: '#d6d3d1',
  },
  fonts: {
    display: '"Iowan Old Style", "Palatino Linotype", Palatino, serif',
    body: 'ui-sans-serif, system-ui, sans-serif',
  },
};

export const midnightTheme: ThemeTokens = {
  id: 'midnight',
  name: 'Midnight',
  description: 'Deep navy with warm gold accent',
  colors: {
    background: '#0a1224',
    foreground: '#e8eef8',
    accent: '#d4a017',
    muted: '#8fa0b8',
    border: '#243552',
  },
  fonts: {
    display: '"Avenir Next", "Segoe UI", sans-serif',
    body: 'ui-sans-serif, system-ui, sans-serif',
  },
};

export const themePacks: ThemeTokens[] = [
  defaultTheme,
  daylightTheme,
  midnightTheme,
];

export function getThemePack(id: string | null | undefined): ThemeTokens {
  const found = themePacks.find((p) => p.id === id);
  return found ?? defaultTheme;
}

export type ThemeTokenOverrides = Partial<{
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  border: string;
  displayFont: string;
  bodyFont: string;
}>;

export function resolveThemeTokens(
  packId: string | null | undefined,
  overrides?: ThemeTokenOverrides | null,
): ThemeTokens {
  const base = getThemePack(packId);
  if (!overrides) return base;
  return {
    ...base,
    colors: {
      background: overrides.background ?? base.colors.background,
      foreground: overrides.foreground ?? base.colors.foreground,
      accent: overrides.accent ?? base.colors.accent,
      muted: overrides.muted ?? base.colors.muted,
      border: overrides.border ?? base.colors.border,
    },
    fonts: {
      display: overrides.displayFont ?? base.fonts.display,
      body: overrides.bodyFont ?? base.fonts.body,
    },
  };
}

/** CSS custom properties for storefront / admin previews */
export function themeToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--theme-bg': tokens.colors.background,
    '--theme-fg': tokens.colors.foreground,
    '--theme-accent': tokens.colors.accent,
    '--theme-muted': tokens.colors.muted,
    '--theme-border': tokens.colors.border,
    '--theme-font-display': tokens.fonts.display,
    '--theme-font-body': tokens.fonts.body,
  };
}
