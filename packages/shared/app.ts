// JSON so apps/mobile/app.config.ts can read it too: Expo loads that file
// with plain Node, which can't require TypeScript.
import schemes from './app-schemes.json';

// The app's build variants each have their own deep-link scheme, so
// development, preview and production builds can sit side by side on a phone.
export const APP_SCHEMES = schemes;
