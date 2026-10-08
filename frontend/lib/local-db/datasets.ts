import { localDB, type DatasetEntry } from "./schema";
export async function saveDatasetEntry(value: DatasetEntry, db = localDB()) {
  if (!await db.testCases.get(value.test_case_id)) throw new Error("Test case not found");
  await db.datasets.put(value); return value;
}
export const datasetPage = (offset = 0, limit = 50, db = localDB()) => db.datasets.toCollection().offset(Math.max(0, offset)).limit(Math.min(200, Math.max(1, limit))).toArray();
