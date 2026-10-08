import { localDB, storageError, type LocalCase } from "./schema";
export async function saveTestCase(value: LocalCase, db = localDB()) {
  if (!await db.documents.get(value.document_id)) throw new Error("Document not found");
  try { await db.testCases.put(value); } catch (e) { storageError(e); } return value;
}
export async function deleteTestCases(ids: string[], db = localDB()) {
  const unique = [...new Set(ids)];
  return db.transaction("rw", db.testCases, db.results, db.datasets, async () => {
    const found = (await db.testCases.bulkGet(unique)).filter(Boolean).length;
    await db.results.where("test_case_id").anyOf(unique).delete(); await db.datasets.where("test_case_id").anyOf(unique).delete();
    await db.testCases.bulkDelete(unique); return { requested: unique.length, deleted: found, already_missing: unique.length - found };
  });
}
