import { localDB, storageError, type LocalRun } from "./schema";
export async function saveResults(runs: LocalRun[], db = localDB()) {
  try {
    await db.transaction("rw", db.testCases, db.results, async () => {
      for (const run of runs) if (!await db.testCases.get(run.test_case_id)) throw new Error("Test case not found");
      // IDs distinguish intentional repeats; put makes retrying the same save idempotent.
      await db.results.bulkPut(runs);
    });
  } catch (e) { storageError(e); }
}
export const caseResults = (id: string, db = localDB()) => db.results.where("test_case_id").equals(id).sortBy("created_at");
