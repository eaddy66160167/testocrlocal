import { type Table } from "dexie";
import { localDB, digest, SCHEMA_VERSION, type BinaryAsset } from "./schema";
const metadataStores = ["documents", "testCases", "results", "datasets", "categories", "documentTypes"] as const;
type RecordValue = { id: string; [key: string]: unknown };
type Manifest = { format: "ocr-local-backup"; schema: number; created_at: string; stores: Record<string, RecordValue[]>; assets: { id: string; document_id: string; page_number: number | null; mime: string; size: number; sha256: string }[] };
const encoder = new TextEncoder();
const MAGIC = "OCRLOCAL2\n";
const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
export async function exportBackup(db = localDB()): Promise<Blob> {
  const snapshot = await db.transaction("r", db.tables, async () => {
    const stores: Record<string, RecordValue[]> = {};
    for (const name of metadataStores) stores[name] = await db.table(name).toArray();
    return { stores, assets: await db.assets.toArray() };
  });
  const manifest: Manifest = { format: "ocr-local-backup", schema: SCHEMA_VERSION, created_at: new Date().toISOString(), stores: snapshot.stores, assets: [] };
  for (const a of snapshot.assets) manifest.assets.push({ id: a.id, document_id: a.document_id, page_number: a.page_number, mime: a.blob.type, size: a.blob.size, sha256: await digest(await a.blob.arrayBuffer()) });
  const bytes = encoder.encode(JSON.stringify(manifest));
  const header = encoder.encode(`${MAGIC}${bytes.byteLength}\n${await digest(bytes.buffer as ArrayBuffer)}\n`);
  return new Blob([header, bytes, ...snapshot.assets.map(a => a.blob)], { type: "application/octet-stream" });
}
export async function restoreBackup(blob: Blob, conflict: "reject" | "replace", db = localDB()) {
  if (blob.size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds 512 MB restore limit");
  const prefix = new TextDecoder().decode(await blob.slice(0, 200).arrayBuffer());
  const header = /^OCRLOCAL2\n(\d+)\n([a-f0-9]{64})\n/.exec(prefix);
  if (!header) throw new Error("Invalid backup header (legacy exports require an explicit converter)");
  const size = Number(header[1]), start = header[0].length;
  if (!Number.isSafeInteger(size) || size < 2 || size > 32 * 1024 * 1024 || start + size > blob.size) throw new Error("Invalid manifest length");
  const bytes = await blob.slice(start, start + size).arrayBuffer();
  if (await digest(bytes) !== header[2]) throw new Error("Backup metadata checksum mismatch");
  const manifest = JSON.parse(new TextDecoder().decode(bytes)) as Manifest;
  if (manifest.format !== "ocr-local-backup" || ![1, SCHEMA_VERSION].includes(manifest.schema) || !Array.isArray(manifest.assets) || !manifest.stores) throw new Error("Unsupported backup schema");
  for (const name of metadataStores) {
    const values = manifest.stores[name];
    if (!Array.isArray(values) || values.some(v => !v || typeof v.id !== "string" || !v.id) || new Set(values.map(v => v.id)).size !== values.length) throw new Error(`Invalid store ${name}`);
  }
  const documentIDs = new Set(manifest.stores.documents.map(v => v.id));
  const caseIDs = new Set(manifest.stores.testCases.map(v => v.id));
  if (manifest.stores.testCases.some(v => !documentIDs.has(String(v.document_id))) || [...manifest.stores.results, ...manifest.stores.datasets].some(v => !caseIDs.has(String(v.test_case_id)))) throw new Error("Dangling backup relationship");
  let cursor = start + size; const assets: BinaryAsset[] = [];
  const assetIDs = new Set<string>();
  for (const a of manifest.assets) {
    if (!a || typeof a.id !== "string" || assetIDs.has(a.id) || !documentIDs.has(a.document_id) || !Number.isSafeInteger(a.size) || a.size < 0 || cursor + a.size > blob.size || typeof a.mime !== "string") throw new Error("Invalid binary manifest");
    assetIDs.add(a.id); const binary = blob.slice(cursor, cursor + a.size, a.mime); cursor += a.size;
    if (await digest(await binary.arrayBuffer()) !== a.sha256) throw new Error("Backup binary checksum mismatch");
    assets.push({ id: a.id, document_id: a.document_id, page_number: a.page_number, sha256: a.sha256, blob: binary });
  }
  if (cursor !== blob.size || manifest.stores.documents.some(v => !assets.some(a => a.id === v.id && a.document_id === v.id && a.page_number === null))) throw new Error("Incomplete backup assets");
  // All hashes and relationships are checked before the first write. No secret config cache is exported.
  await db.transaction("rw", db.tables, async () => {
    if (conflict === "reject") {
      for (const name of metadataStores) for (const value of manifest.stores[name]) if (await db.table(name).get(value.id)) throw new Error(`Restore conflict in ${name}: ${value.id}`);
      for (const asset of assets) if (await db.assets.get(asset.id)) throw new Error("Restore asset conflict");
    } else {
      // Replace the entire personal dataset atomically; avoid mixing stale child records.
      for (const name of [...metadataStores, "assets"]) await db.table(name).clear();
    }
    for (const name of metadataStores) {
      const values = manifest.stores[name];
      if (name === "results") values.forEach(v => { v.pipeline_revision ??= 0; });
      await (db.table(name) as Table).bulkPut(values);
    }
    await db.assets.bulkPut(assets);
  });
  return { documents: manifest.stores.documents.length, results: manifest.stores.results.length };
}
