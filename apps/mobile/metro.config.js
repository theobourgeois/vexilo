// https://docs.expo.dev/guides/customizing-metro/
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.join(repoRoot, 'packages/shared');

const config = getDefaultConfig(projectRoot);

// packages/shared lives outside the app, so Metro has to watch it.
config.watchFolders = [sharedRoot];

// Its imports (zod) resolve from the app's node_modules, like everything else.
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];

// Walking up from packages/shared would otherwise reach the website's
// node_modules, which EAS never installs. Blocking it keeps local bundles the
// same as EAS's.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...config.resolver.blockList,
  new RegExp(
    `^${escapeRegExp(path.join(repoRoot, 'node_modules') + path.sep)}`,
  ),
];

module.exports = config;
