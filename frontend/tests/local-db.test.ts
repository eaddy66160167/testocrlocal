import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { LocalDatabase } from "../lib/local-db/schema";
import { saveDocument, deleteDocuments } from "../lib/local-db/documents";
import { saveTestCase, deleteTestCases } from "../lib/local-db/test-cases";
import { saveResults } from "../lib/local-db/results";
import { historyPage } from "../lib/local-db/history";
import { exportBackup, restoreBackup } from "../lib/local-db/backup";
const document = { id: "doc", filename: "synthetic.png", mime_type: "image/png", width: 1, height: 1, created_at: "2026-10-08T00:00:00Z", storage_key: "doc", document_type: "image" as const, page_count: 1, page_number: null };
test("Blobs, refresh persistence, metadata history and profile isolation", async () => {
  const name = crypto.randomUUID(), db = new LocalDatabase(name);
  await saveDocument(document, new Blob(["synthetic"], { type: "image/png" }), db);
  await saveTestCase({ id: "case", document_id: "doc", page_number: null, roi: null, ground_truth_raw: null, ground_truth_normalized: null, status: "draft", created_at: document.created_at, updated_at: document.created_at, categories: [] }, db);
  assert.equal((await db.assets.get("doc"))?.blob instanceof Blob, true);
  assert.equal((await historyPage({}, db))[0].id, "case"); db.close();
  const reopened = new LocalDatabase(name), other = new LocalDatabase(crypto.randomUUID());
  assert.equal(await reopened.documents.count(), 1); assert.equal(await other.documents.count(), 0);
  await deleteDocuments(["doc"], reopened); assert.equal(await reopened.testCases.count(), 0); assert.equal(await reopened.assets.count(), 0);
  await reopened.delete(); await other.delete();
});
test("backup verifies metadata and binaries before atomic restore; conflicts explicit", async () => {
  const db = new LocalDatabase(crypto.randomUUID()), target = new LocalDatabase(crypto.randomUUID());
  await saveDocument(document, new Blob(["synthetic"]), db);
  const backup = await exportBackup(db); await restoreBackup(backup, "reject", target);
  assert.equal(await (await target.assets.get("doc"))?.blob.text(), "synthetic");
  await assert.rejects(restoreBackup(backup, "reject", target), /conflict/);
  const bad = new Blob([backup.slice(0, -1), "X"]);
  await assert.rejects(restoreBackup(bad, "replace", target), /checksum/);
  assert.equal(await target.documents.count(), 1);
  await restoreBackup(backup, "replace", target);
  await db.delete(); await target.delete();
});
test("v1 upgrade retains data and marks unknown execution revision", async () => {
  const name = crypto.randomUUID(), old = new Dexie(name);
  old.version(1).stores({documents:"id,created_at,document_type_id",assets:"id,document_id,[document_id+page_number]",testCases:"id,document_id,created_at,status",results:"id,test_case_id,pipeline_id,created_at",datasets:"id,test_case_id,global_field_id",categories:"id,&code",documentTypes:"id",config:"id"});
  await old.table("results").put({ id: "old", test_case_id: "case", pipeline_id: "pipe" }); old.close();
  const db = new LocalDatabase(name); assert.equal((await db.results.get("old"))?.pipeline_revision, 0); await db.delete();
});
test("execution IDs preserve repeats and repeated save is idempotent; bulk delete cascades", async () => {
  const db = new LocalDatabase(crypto.randomUUID()); await saveDocument(document, new Blob(["x"]), db);
  await db.testCases.put({ id: "case", document_id: "doc", status: "tested", created_at: document.created_at } as never);
  const runs = ["r1", "r2"].map(id => ({ id, test_case_id: "case", pipeline_id: "p", pipeline_revision: 5 }));
  await saveResults(runs as never, db); await saveResults(runs as never, db); assert.equal(await db.results.count(), 2);
  assert.deepEqual(await deleteTestCases(["case", "missing"], db), {requested:2,deleted:1,already_missing:1});
  assert.equal(await db.results.count(), 0); assert.equal(await db.documents.count(), 1); await db.delete();
});
