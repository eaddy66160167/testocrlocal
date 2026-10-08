import { type BinaryAsset, type LocalDocument, localDB, digest, storageError, type LocalDatabase } from "./schema";
export async function saveDocument(document: LocalDocument, blob: Blob, db = localDB()) {
  const asset: BinaryAsset = { id: document.id, document_id: document.id, page_number: null, blob, sha256: await digest(await blob.arrayBuffer()) };
  try { await db.transaction("rw", db.documents, db.assets, async () => { await db.documents.put(document); await db.assets.put(asset); }); }
  catch (error) { storageError(error); }
  return document;
}
export async function deleteDocuments(ids: string[], db = localDB()) {
  await db.transaction("rw", db.documents, db.assets, db.testCases, db.results, db.datasets, async () => {
    for (const id of new Set(ids)) {
      const cases = await db.testCases.where("document_id").equals(id).primaryKeys();
      await db.results.where("test_case_id").anyOf(cases).delete();
      await db.datasets.where("test_case_id").anyOf(cases).delete();
      await db.testCases.bulkDelete(cases); await db.assets.where("document_id").equals(id).delete(); await db.documents.delete(id);
    }
  });
}
export async function documentBlob(id: string, db: LocalDatabase = localDB()) {
  const asset = await db.assets.get(id); if (!asset) throw new Error("ไม่พบไฟล์ในเบราว์เซอร์นี้"); return asset.blob;
}
// The caller must invoke dispose when its preview is replaced or unmounted.
export async function documentURL(id: string, db = localDB()) {
  const url = URL.createObjectURL(await documentBlob(id, db)); return { url, dispose: () => URL.revokeObjectURL(url) };
}
export async function storageUsage() {
  const estimate = await navigator.storage?.estimate(); const usage = estimate?.usage ?? 0, quota = estimate?.quota ?? 0;
  return { usage, quota, lowSpace: quota > 0 && usage / quota >= 0.8, persisted: await navigator.storage?.persisted() ?? false };
}
