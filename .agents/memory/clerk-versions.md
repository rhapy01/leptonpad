---
name: Clerk version compatibility
description: @clerk/react must be 6.x to be compatible with @clerk/express in this project; 5.x causes build failures
---

## Rule
Always use `@clerk/react@^6.x` in the frontend. Do not use `5.x`.

**Why:** `@clerk/express` (used by the API server) installs `@clerk/shared@4.17.1`. `@clerk/react@5.54.0` was compiled against a different `@clerk/shared` version that used camelCase `Ui` naming (e.g. `loadClerkUiScript`), but `@clerk/shared@4.17.1` uses uppercase `UI` naming (e.g. `loadClerkUIScript`). This mismatch causes Vite's esbuild bundler to fail at startup with "No matching export" errors. `@clerk/react@6.9.1` declares `@clerk/shared@^4.17.1` as its peer dep and uses matching export names.

**How to apply:** When installing or upgrading Clerk packages in `artifacts/leptonpad`, always pin `@clerk/react@^6.x`. If `@clerk/react` is already at a working version, do not upgrade without checking `@clerk/shared` compatibility first.
