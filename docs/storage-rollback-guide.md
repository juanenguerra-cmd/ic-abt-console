# Storage rollback guide

This guide documents the safest rollback path for the storage-reduction work.

## Goal of the change

The storage-reduction path is intended to:
- keep IndexedDB as the main live database store
- reduce duplicate full-database copies in the browser
- keep restore and backup workflows available
- make it easy to turn the old behavior back on if needed

## Current rollback switch

File:
- `src/constants/storagePolicy.ts`

Primary flag:
- `writeLegacyLocalStorageMirror`

### Recommended normal mode

```ts
writeLegacyLocalStorageMirror: false
```

This mode is intended to reduce local browser storage growth by avoiding the extra full-database localStorage mirror during normal saves.

### Fast rollback mode

```ts
writeLegacyLocalStorageMirror: true
```

Use this if you need to restore the legacy behavior where a full serialized database copy is also written into localStorage.

## When to roll back

Turn the legacy mirror back on if any of the following happens after deployment:
- startup load depends on a localStorage fallback path that users still need
- a browser/environment has trouble reading IndexedDB but was previously recovering from localStorage
- restore/recovery workflows behave differently than expected
- a critical production workflow needs the old duplicate mirror immediately

## Rollback steps

1. Open `src/constants/storagePolicy.ts`
2. Change:

```ts
writeLegacyLocalStorageMirror: false
```

to:

```ts
writeLegacyLocalStorageMirror: true
```

3. Rebuild and redeploy
4. Validate:
- app opens normally after refresh
- save still works
- export/restore still works
- restore previous still works
- cross-device sync still works

## Extra safety

Before any deeper storage reduction changes:
- export a manual JSON backup
- verify Restore Previous is available
- validate round-trip restore in a test environment

## Notes

This rollback guide is intentionally simple so the behavior can be restored quickly without changing schema, reports, or business logic.
