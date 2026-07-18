import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Integration tests share one test database and truncate it between
      // runs; running test files serially avoids cross-file truncate races.
      fileParallelism: false,
    },
  }),
)
