export { SCHEMA_VERSION } from "./schema";
// Dexie executes upgrades within the version-change transaction. A failed upgrade
// rolls back. Version 2 backfills revision=0 for legacy local runs (unknown revision).
export const migrationPolicy = "Never delete user data during schema upgrades.";
