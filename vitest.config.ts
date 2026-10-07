import { defineConfig, configDefaults } from 'vitest/config';

// Tests run with the eras' gameplay changes (their own weapon and arena) switched off, so the tuning-based tests stay stable.
// Tests that are about eras switch it back on. Other windows' working copies (.claude/worktrees) are theirs to test, not ours.
export default defineConfig({ test: { setupFiles: ['./src/test-setup.ts'], exclude: [...configDefaults.exclude, '.claude/**'] } });
