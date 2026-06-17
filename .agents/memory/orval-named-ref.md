---
name: Orval named $ref for request bodies
description: Inline request body schemas in OpenAPI cause name collisions in Orval codegen output. Always use named $ref.
---

When an OpenAPI path defines a request body schema inline (not via `$ref`), Orval generates a name based on the operation ID. If two operations share a similar name pattern, the generated Zod schema names collide and codegen fails.

**Fix:** Always define request body schemas in `components/schemas` with a descriptive name and reference them with `$ref`:

```yaml
requestBody:
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/VerifyInput'
```

**Why:** Named schemas produce stable, unique Zod identifiers. Inline schemas produce auto-names from the operation path that can collide.
