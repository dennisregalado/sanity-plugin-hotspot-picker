import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  dist: 'dist',
  tsconfig: 'tsconfig.dist.json',
  exports: {
    '.': {
      source: './src/index.ts',
      import: './dist/index.js',
      default: './dist/index.js',
    },
  },

  // `@sanity/ui` and `@sanity/icons` are peers on purpose: the plugin imports their v4/v5 subpaths
  // (`@sanity/ui/tooltip`, `@sanity/icons/Add`, ...) and must use the Studio's own copy, which
  // `sanity` ^6 installs. pkg-utils errors on UI/icons peers by default.
  strictOptions: {
    noSanityUiPeerDependency: 'off',
    noSanityIconsPeerDependency: 'off',
  },

  // Remove this block to enable strict export validation
  extract: {
    checkTypes: false,
    rules: {
      'ae-incompatible-release-tags': 'off',
      'ae-internal-missing-underscore': 'off',
      'ae-missing-release-tag': 'off',
    },
  },
})
