import type { ConfigContext, ExpoConfig } from 'expo/config';

import APP_SCHEMES from '../../packages/shared/app-schemes.json';
import type { AppExtra, AppVariant } from './src/config';

// The website's page background (src/app/globals.css), light and dark.
const BACKGROUND_LIGHT = '#f3f2ef';
const BACKGROUND_DARK = '#131416';

type VariantSettings = {
  name: string;
  bundleId: string;
  icon: string;
  androidIconBackground: string;
  apiUrl: string;
};

// Each variant installs side by side with the others, under its own name,
// icon, bundle ID and deep-link scheme, and talks to its own website.
const VARIANTS: Record<AppVariant, VariantSettings> = {
  development: {
    name: 'Vexilo Dev',
    bundleId: 'org.vexilo.dev',
    icon: './assets/images/icon-development.png',
    androidIconBackground: '#fed7aa',
    // Your machine running `npm run dev` (or `dev:local`) at the repo root;
    // override in apps/mobile/.env.local for a phone (LAN address or ngrok).
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  },
  preview: {
    name: 'Vexilo Preview',
    bundleId: 'org.vexilo.preview',
    icon: './assets/images/icon-preview.png',
    androidIconBackground: '#c7d2fe',
    // There's no staging website, so internal test builds use the real one.
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://vexilo.org',
  },
  production: {
    name: 'Vexilo',
    bundleId: 'org.vexilo',
    icon: './assets/images/icon.png',
    androidIconBackground: '#ffffff',
    apiUrl: 'https://vexilo.org',
  },
};

function readVariant(): AppVariant {
  const variant = process.env.APP_VARIANT ?? 'development';
  if (!(variant in VARIANTS)) {
    throw new Error(
      `APP_VARIANT must be one of ${Object.keys(VARIANTS).join(', ')}; got "${variant}"`,
    );
  }
  return variant as AppVariant;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = readVariant();
  const settings = VARIANTS[variant];
  const extra: AppExtra = { variant, apiUrl: settings.apiUrl };

  return {
    ...config,
    name: settings.name,
    slug: 'vexilo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: settings.icon,
    scheme: APP_SCHEMES[variant],
    userInterfaceStyle: 'automatic',
    backgroundColor: BACKGROUND_LIGHT,
    platforms: ['ios', 'android'],
    ios: {
      bundleIdentifier: settings.bundleId,
      supportsTablet: true,
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: settings.bundleId,
      adaptiveIcon: {
        backgroundColor: settings.androidIconBackground,
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: BACKGROUND_LIGHT,
          image: './assets/images/splash-icon.png',
          imageWidth: 160,
          dark: { backgroundColor: BACKGROUND_DARK },
        },
      ],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra,
  };
};
