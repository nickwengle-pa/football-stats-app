import { createSystem, defaultConfig } from '@chakra-ui/react';

const customConfig = {
  theme: {
    tokens: {
      fonts: {
        heading: { value: `'Inter', sans-serif` },
        body: { value: `'Inter', sans-serif` },
        mono: { value: `'JetBrains Mono', monospace` },
      },
      colors: {
        neutral: {
          50: { value: '#f5f7fa' },
          100: { value: '#e4e8ef' },
          200: { value: '#cbd1dd' },
          300: { value: '#b1b9cb' },
          400: { value: '#97a1b9' },
          500: { value: '#7e89a6' },
          600: { value: '#646f8a' },
          700: { value: '#4b556d' },
          800: { value: '#323c51' },
          900: { value: '#1b2334' },
        },
        brand: {
          50: { value: '#e8f1ff' },
          100: { value: '#c1d8ff' },
          200: { value: '#9bbfff' },
          300: { value: '#74a6ff' },
          400: { value: '#4e8dff' },
          500: { value: '#3373e6' },
          600: { value: '#2659b4' },
          700: { value: '#1a3f82' },
          800: { value: '#0d2451' },
          900: { value: '#010a22' },
        },
      },
    },
    semanticTokens: {
      colors: {
        'bg.canvas': { value: { _light: '{colors.neutral.50}', _dark: '{colors.neutral.900}' } },
        'bg.surface': { value: { _light: 'white', _dark: '{colors.neutral.800}' } },
        'text.primary': { value: { _light: '{colors.neutral.900}', _dark: '{colors.neutral.50}' } },
        'text.secondary': { value: { _light: '{colors.neutral.600}', _dark: '{colors.neutral.300}' } },
        'border.subtle': { value: { _light: '{colors.neutral.200}', _dark: '{colors.neutral.700}' } },
        'brand.solid': { value: { _light: '{colors.brand.500}', _dark: '{colors.brand.300}' } },
        'brand.muted': { value: { _light: '{colors.brand.100}', _dark: '{colors.brand.700}' } },
      },
    },
    globalCss: {
      body: {
        bg: 'bg.canvas',
        color: 'text.primary',
      },
    },
  },
};

export const theme = createSystem(defaultConfig, customConfig);
export type AppTheme = typeof theme;
