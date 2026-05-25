import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['src/index.tsx'],
    format: ['esm'],
    dts: true,
    clean: true,
    treeshake: true,
    sourcemap: true,
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  fmt: {
    printWidth: 80,
    jsdoc: {
      capitalizeDescriptions: false,
    },
    sortImports: {},
    singleQuote: true,
    semi: false,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
})
