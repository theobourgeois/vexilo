The Vexilo app: Expo / React Native, iOS and Android only.

## Expo has changed: don't trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS or React Native API:

1. Read the major version of `expo` in `package.json`.
2. Read the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For anything else, start from https://docs.expo.dev/llms.txt. Never answer from memory.

## Commands

```bash
npx expo install <package>  # always, instead of npm install: picks SDK-compatible versions
npx expo start              # dev server
npm run lint && npm run typecheck   # before calling anything done
npx expo-doctor             # dependency and config problems
```

## Rules

- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them; configure native behaviour in `app.config.ts` and config plugins.
- Expo Go only has its bundled native modules. A library with native code means a development build (`npx expo run:ios|android` or `eas build --profile development`).
- Routes live in `src/app/` and nothing else does. Screen bodies go in `src/screens/`, shared UI in `src/components/`.
- Variants (`APP_VARIANT=development|preview|production`) each have their own name, icon, bundle ID, scheme and API URL, all in `app.config.ts`. Read them through `src/config.ts`.
- Code shared with the website comes from `@shared/*` (`packages/shared` at the repo root): types, validation, pure logic. Never hand-copy a type or helper from the website; move it into `packages/shared`. Files there may import only `zod` and each other.
- The website talks to itself through server actions, which the app can't call. The app needs HTTP routes under `src/app/api/` on the website.
