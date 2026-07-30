---
name: dataloaders
description: How to use and add DataLoaders in the Commons backend. Use when implementing batched lookups, adding a new loader, wiring field resolvers to loaders, or avoiding N+1 via request-scoped batching and caching.
---

# Dataloaders

Use this skill when you need to **use** DataLoaders (usage is below) or **add** a new one (see [creating-loaders.md](creating-loaders.md)).

For **when** to use dataloaders in GraphQL (e.g. to fix N+1 in resolvers), see [docs/dataloaders.md](../../docs/dataloaders.md) and the "Anti-patterns" section below.

## What DataLoaders do

- **Batch** many `load(key)` calls within a request into fewer bulk queries.
- **Cache** results per key for the lifetime of the request so the same key is not fetched twice.
- **Request-scoped** registry ensures one loader instance per request for maximum batching and cache sharing.

Registry and helpers live in `commons-packages/backend/graphql/shared/loaders.ts`. Detailed rationale and examples: [docs/dataloaders.md](../../docs/dataloaders.md).

## How to use DataLoaders

### Model loader method

Use the model’s loader method so the request-local registry is used automatically:

```typescript
const task = await Task.taskByIdLoader().load(taskId);
```

No need to pass an argument unless there is a locally created loaders instance in scope. `DataLoaders.getOrCreateLoader` uses the request-local `DataLoaders` instance when available.

### Directly from the loader registry (legacy code: should be opportunistically refactored to the model pattern)

Older loaders are exposed on the shared loader registry and are available from context:

```typescript
const market = await context.dataLoaders.market.load(marketId);
const tasks = await context.dataLoaders.tasksForGoal.load(root.id);
```

Use this for loaders that are still defined as properties on the `DataLoaders` class in `loaders.ts`. When adding **new** loaders, use the model-loader pattern above.

### When GraphQL context is not available

Pass no arguments to automatically get the request local instance from async local storage.

```typescript
const task = await Task.taskByIdLoader().load(taskId);
```

Only create a **new** `DataLoaders()` instance when you intentionally want a separate cache scope (e.g. tests or a narrow scope). Do **not** create `new DataLoaders()` inside services; pass request-scoped loaders in from the resolver/context so batching and caching work across the request.

## How to add a DataLoader

Step-by-step creation instructions (bulk fetch, factory, accessor, returnsSingleItem vs returnsMultipleItems, compound keys) are in [creating-loaders.md](creating-loaders.md).

## Anti-patterns

- **Direct model fetch in a field resolver**
  Avoid `Model.get(id)` (or similar) in a resolver when that resolver runs per parent—it causes N+1. Use a loader instead: `context.dataLoaders.<loader>.load(key)` or `Model.xxxLoader().load(key)`.

- **Creating DataLoaders inside services**
  Do not instantiate `new DataLoaders()` in a service. Batching and caching are request-scoped; services should receive the request-scoped loaders from the resolver (or use the model loader method, which uses the request-local store).

- **Per-item fetch in a loop**
  Avoid `for (const id of ids) { await Model.get(id); }`. Collect ids, call one batch method (or use a loader with `loadMany`), then map results back.

- **Manual batching or caching instead of a DataLoader**
  Do not hand-roll batch queries or in-memory caches to solve N+1 or duplicate lookups. Use a DataLoader so batching and request-scoped caching are consistent and shared across the request.

- **Sequential `.load()` calls instead of parallel**
  Avoid awaiting multiple `loader.load(key)` calls one after another. DataLoader batches only when multiple requests are made at once (in the same synchronous block of code). Use `Promise.all([...])` with all of the loader calls you will need to make.

  _note that this is an exception to our usual guidance to avoid `Promise.all`. That is because in this case, multiple promises can correspond to a single async operation_.

## Pitfalls

- **Transactions**
  Loaders read outside a transaction. Data created inside an open transaction may not be visible to loader-backed code until the transaction commits.

- **Stale cache**
  If you mutate data in the same request, the loader cache can be stale. Clear the key with `loader.clear(key)` near the mutation if necessary.

## References

- [creating-loaders.md](creating-loaders.md) — step-by-step instructions for adding a new DataLoader
- [docs/dataloaders.md](../../docs/dataloaders.md) — rationale and examples
- `commons-packages/backend/graphql/shared/loaders.ts` — `DataLoaders`, `returnsSingleItem`, `returnsMultipleItems`, `getOrCreateLoader`, `getRequestLocalLoaders`
