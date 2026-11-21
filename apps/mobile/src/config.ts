import Constants from 'expo-constants';

export type AppVariant = 'development' | 'preview' | 'production';

/** Per-variant settings app.config.ts puts in `extra`. */
export type AppExtra = {
  variant: AppVariant;
  /** The website the app's API calls go to. */
  apiUrl: string;
};

function readExtra(): AppExtra {
  const extra = Constants.expoConfig?.extra as Partial<AppExtra> | undefined;
  if (!extra?.variant || !extra.apiUrl) {
    throw new Error("app.config.ts didn't set the app's variant settings");
  }
  return { variant: extra.variant, apiUrl: extra.apiUrl };
}

export const appConfig = readExtra();
