import { defineConfig } from 'vitest/config';

// npm run lab: the balance lab only (src/tools/*.lab.ts). It plays the real game (eras, weapons arriving), so no test setup file.
export default defineConfig({ test: { include: ['src/tools/**/*.lab.ts'], testTimeout: 60 * 60 * 1000 } });
