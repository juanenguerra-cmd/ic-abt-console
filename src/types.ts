// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  DEPRECATED — backward-compatibility re-export shim only.                  ║
// ║                                                                              ║
// ║  All canonical type definitions live in:  src/domain/models.ts              ║
// ║                                                                              ║
// ║  ACTION REQUIRED: migrate your import to the canonical path:                ║
// ║    ✗  import { Resident } from "../types"                                   ║
// ║    ✓  import { Resident } from "../domain/models"                           ║
// ║                                                                              ║
// ║  This shim will be removed once all consumers are migrated.                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
export * from "./domain/models";
