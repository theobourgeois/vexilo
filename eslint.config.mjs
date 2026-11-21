import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // The Expo app has its own lint setup (apps/mobile/eslint.config.js).
  { ignores: ["apps/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // packages/shared is bundled into the Expo app too, which only installs
    // zod alongside it and runs on Hermes, not Node or the browser.
    files: ["packages/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!zod(?:/|$)|\\.\\.?/)",
              message:
                "packages/shared may only import zod and other files in packages/shared.",
            },
            {
              regex: "(?:^|/)(?:src|apps)/",
              message:
                "packages/shared can't reach into the website or the app; move the code into packages/shared instead.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
