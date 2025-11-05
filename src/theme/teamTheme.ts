import { useMemo } from 'react';
import { createSystem } from '@chakra-ui/react';
import { theme as baseTheme } from './index';
import { TeamBranding } from '../models';

export interface TeamTheme {
  system: ReturnType<typeof createSystem>;
  palette: TeamBranding;
}

const defaultBranding: TeamBranding = {
  primaryColor: '#3373e6',
  secondaryColor: '#1a3f82',
  accentColor: '#f7b731',
  logoUrl: undefined,
  wordmarkUrl: undefined,
};

const resolveColor = (value: string | undefined, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const buildBrandTokens = (branding: TeamBranding): Parameters<typeof createSystem>[0] => {
  const primary = resolveColor(branding.primaryColor, defaultBranding.primaryColor!);
  const secondary = resolveColor(branding.secondaryColor, defaultBranding.secondaryColor!);
  const accent = resolveColor(branding.accentColor, defaultBranding.accentColor!);

  return {
    theme: {
      semanticTokens: {
        colors: {
          'brand.primary': { value: { _light: primary, _dark: primary } },
          'brand.secondary': { value: { _light: secondary, _dark: secondary } },
          'brand.accent': { value: { _light: accent, _dark: accent } },
          'brand.surface': { value: { _light: `${primary}14`, _dark: `${primary}26` } },
          'brand.gradient': {
            value: {
              _light: `linear-gradient(135deg, ${primary}, ${secondary})`,
              _dark: `linear-gradient(135deg, ${secondary}, ${primary})`,
            },
          },
        },
      },
    },
  };
};

export const useTeamTheme = (branding?: TeamBranding | null): TeamTheme =>
  useMemo(() => {
    const palette = {
      ...defaultBranding,
      ...branding,
    };

    const system = createSystem(baseTheme._config, buildBrandTokens(palette));

    return {
      system,
      palette,
    };
  }, [branding]);
