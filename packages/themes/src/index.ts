/** Theme packs + design tokens — Phase 0 sample */

export type ThemeTokens = {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
  };
};

export const defaultTheme: ThemeTokens = {
  id: 'default',
  name: 'Default',
  colors: {
    background: '#0f1419',
    foreground: '#f4f6f8',
    accent: '#3d8bfd',
  },
};

export const themePacks: ThemeTokens[] = [defaultTheme];
