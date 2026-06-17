---
name: Orval void return type
description: How to handle endpoints that return 204 No Content — Orval types them as T | void which breaks ReactNode conditionals.
---

When a GET endpoint returns 204 (No Content), Orval generates the return type as `T | void`. This means:

1. `data && <JSX />` is invalid because `void && ...` evaluates to `void`, which is not a ReactNode.
2. Passing the raw value to typed variables expecting `T` also fails.

**Fix:** Narrow explicitly after the query:
```ts
const { data: raw } = useGetNextContent(id, { query: { ... } });
const next: Content | null = raw && typeof raw === "object" ? raw : null;
```

Then use `next && <JSX />` which correctly evaluates to `Element | null`.

**Why:** Orval reflects the OpenAPI spec literally — if the server can return 204, the type includes `void`. The narrowing guard is required at every use site.
