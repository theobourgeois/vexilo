# Vexilo app

Expo / React Native. Not an npm workspace: it has its own `package.json` and lockfile, so the website's build never installs it.

## Run it locally

1. Start the website, from the repo root:
   ```bash
   npm run dev        # or dev:local for the Docker database
   ```
2. Start the app, from `apps/mobile`:
   ```bash
   npm install
   npx expo start
   ```
   Open it in Expo Go, or in a development build once the app needs native modules Expo Go doesn't have.

The development variant calls `http://localhost:3000`, which works from the iOS Simulator. Elsewhere, set `EXPO_PUBLIC_API_URL` in a git-ignored `apps/mobile/.env.local`:

- **Android emulator:** `http://10.0.2.2:3000`, or run `adb reverse tcp:3000 tcp:3000` and keep `localhost`.
- **A real phone:** your Mac's LAN address (`next dev -H 0.0.0.0`) or an ngrok URL.

## Variants

`APP_VARIANT` picks one; it defaults to `development`. The EAS build profiles in `eas.json` set it.

| Variant     | Name           | Bundle ID            | Scheme           | API          |
| ----------- | -------------- | -------------------- | ---------------- | ------------ |
| development | Vexilo Dev     | `org.vexilo.dev`     | `vexilo-dev`     | your machine |
| preview     | Vexilo Preview | `org.vexilo.preview` | `vexilo-preview` | vexilo.org   |
| production  | Vexilo         | `org.vexilo`         | `vexilo`         | vexilo.org   |

`APP_VARIANT=preview npx expo start` runs another variant locally.

## Shared code

`@shared/*` resolves to `packages/shared` at the repo root, in both the website and the app. `metro.config.js` watches that folder and resolves its imports (only `zod`) from this app's `node_modules`. EAS never installs the website's dependencies, so the app never uses them locally either.

The home screen is a placeholder that runs a few shared functions and compares them with what they return on Node, so you can see the shared code behaves the same on Hermes.

## Installing packages

`.npmrc` sets `min-release-age=7`: npm won't install a version published less than a week ago. `npx expo-doctor` may therefore report patch versions a few days behind the SDK's newest; they catch up on their own.
