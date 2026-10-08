import { localDB } from "./schema";
export async function historyPage({ offset = 0, limit = 20, document_id, status }: { offset?: number; limit?: number; document_id?: string; status?: string } = {}, db = localDB()) {
  const source = document_id ? db.testCases.where("document_id").equals(document_id) : db.testCases.orderBy("created_at").reverse();
  // This query never opens the asset table or hydrates result JSON.
  return source.filter(c => !status || c.status === status).offset(Math.max(0, offset)).limit(Math.min(200, Math.max(1, limit))).toArray();
}
