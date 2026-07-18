import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression test for the `runtimeEnv: import.meta.env` bug: Vite only
 * populates `import.meta.env` with `VITE_`-prefixed vars, so server vars
 * (`UPLOADS_DIR`, `SERVER_URL`) could never be overridden from the real
 * process environment and `UPLOADS_DIR` always silently fell back to its
 * `./uploads` default.
 *
 * `env.ts` reads `process.env` at module-evaluation time, so each case
 * resets the module registry and re-imports it after mutating
 * `process.env`, rather than importing once at the top of the file.
 */
describe('env', () => {
  const ORIGINAL_UPLOADS_DIR = process.env.UPLOADS_DIR

  afterEach(() => {
    if (ORIGINAL_UPLOADS_DIR === undefined) {
      delete process.env.UPLOADS_DIR
    } else {
      process.env.UPLOADS_DIR = ORIGINAL_UPLOADS_DIR
    }
    vi.resetModules()
  })

  it('picks up UPLOADS_DIR from process.env', async () => {
    process.env.UPLOADS_DIR = '/tmp/custom-uploads-dir'
    vi.resetModules()
    const { env } = await import('./env')
    expect(env.UPLOADS_DIR).toBe('/tmp/custom-uploads-dir')
  })

  it('falls back to ./uploads when UPLOADS_DIR is unset', async () => {
    delete process.env.UPLOADS_DIR
    vi.resetModules()
    const { env } = await import('./env')
    expect(env.UPLOADS_DIR).toBe('./uploads')
  })
})
