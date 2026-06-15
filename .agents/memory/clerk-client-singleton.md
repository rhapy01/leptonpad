---
name: Clerk clerkClient singleton
description: clerkClient from @clerk/express is a pre-instantiated object, not a factory — do not call it as a function
---

## Rule
Use `clerkClient.users.getUser(id)` directly. Never write `await clerkClient()` or `const clerk = clerkClient()`.

**Why:** In `@clerk/express@1.x`, `clerkClient` is exported as a pre-instantiated `ClerkClient` object. Calling it as a function throws `TypeError: clerkClient is not a function` at runtime. Older Clerk docs and code examples show the factory pattern (`const clerk = await clerkClient()`) which only applied to a brief transitional API.

**How to apply:** Any server route that needs to look up Clerk users should import `clerkClient` from `@clerk/express` and call methods directly: `clerkClient.users.getUser(id)`, `clerkClient.users.getUserList()`, etc.
