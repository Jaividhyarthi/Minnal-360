---
name: OpenAPI numeric compatibility
description: Compatibility constraint between OpenAPI integer schemas and the workspace's generated Zod runtime.
---

When adding numeric response or query fields to the OpenAPI contract, prefer `number` for values that do not require runtime integer validation. In this workspace's current generated client setup, an OpenAPI `integer` can produce `zod.int()`, which is unavailable in the installed Zod runtime and breaks library typechecking.

**Why:** Code generation succeeded, but the chained workspace typecheck failed on the generated `zod.int()` call.

**How to apply:** Use `number` in the contract for counts and limits unless strict integer validation is essential; rerun codegen and the library typecheck after contract edits.