import Dexie, { type Table } from "dexie";
import type { Document, TestCase, PipelineRun, Category, DocumentType } from "../../types";
export const SCHEMA_VERSION = 2;
export type LocalDocument = Omit<Document, "image_url">;
export type LocalCase = Omit<TestCase, "document" | "runs">;
export type LocalRun = PipelineRun & { test_case_id: string; pipeline_revision: number };
export type BinaryAsset = { id: string; document_id: string; page_number: number | null; blob: Blob; sha256: string };
export type DatasetEntry = { id: string; test_case_id: string; global_field_id: string | null; excluded: boolean; updated_at: string };
export type ConfigEntry = { id: string; revision: number; etag: string; checked_at: number; value: unknown };
export class LocalDatabase extends Dexie {
  documents!: Table<LocalDocument, string>;
  assets!: Table<BinaryAsset, string>;
  testCases!: Table<LocalCase, string>;
  results!: Table<LocalRun, string>;
  datasets!: Table<DatasetEntry, string>;
  categories!: Table<Category, string>;
  documentTypes!: Table<DocumentType, string>;
  config!: Table<ConfigEntry, string>;
  constructor(name = "ocr-local-testing") {
    super(name);
    this.version(1).stores({
      documents: "id,created_at,document_type_id", assets: "id,document_id,[document_id+page_number]",
      testCases: "id,document_id,created_at,status", results: "id,test_case_id,pipeline_id,created_at",
      datasets: "id,test_case_id,global_field_id", categories: "id,&code", documentTypes: "id", config: "id",
    });
    this.version(2).stores({
      results: "id,test_case_id,pipeline_id,created_at,[test_case_id+pipeline_id]",
      testCases: "id,document_id,created_at,status,[document_id+page_number]",
    }).upgrade(tx => tx.table("results").toCollection().modify(row => { row.pipeline_revision ??= 0; }));
  }
}
let singleton: LocalDatabase | undefined;
export function localDB(): LocalDatabase {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable in this browser.");
  return singleton ??= new LocalDatabase();
}
export function storageError(error: unknown): never {
  if (error instanceof Error && /quota/i.test(error.name)) throw new Error("พื้นที่จัดเก็บของเบราว์เซอร์เต็ม กรุณาส่งออกข้อมูลสำรองก่อนลบข้อมูล");
  throw error;
}
export async function digest(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
