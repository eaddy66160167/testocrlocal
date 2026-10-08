import { localDB, type ConfigEntry } from "./local-db/schema";
let generation = 0;
const pending = new Map<string, Promise<ConfigEntry>>();
export async function configuration<T>(path: string, base: string): Promise<T> {
  const currentGeneration = generation;
  const id = `${base}${path}`, db = localDB(), old = await db.config.get(id);
  if (old && Date.now() - old.checked_at < 60000) return old.value as T;
  let promise = pending.get(id);
  if (!promise) {
    promise = (async () => {
      const response = await fetch(`${base}/api${path}`, { headers: old ? {"If-None-Match":old.etag} : {}, cache:"no-store" });
      if (!response.ok && response.status !== 304) throw new Error("โหลดการตั้งค่า Pipeline ไม่สำเร็จ");
      const entry: ConfigEntry = response.status === 304 && old ? {...old, checked_at:Date.now()} : {
        id, revision:Number(response.headers.get("X-Config-Revision")), etag:response.headers.get("ETag") ?? "", checked_at:Date.now(), value:await response.json(),
      };
      if(currentGeneration === generation) await db.config.put(entry); return entry;
    })(); pending.set(id, promise);
  }
  try { const entry=await promise; return currentGeneration === generation ? entry.value as T : configuration<T>(path,base); } finally { if(pending.get(id)===promise) pending.delete(id); }
}
export const invalidateConfiguration = async () => {generation++;pending.clear();await localDB().config.clear();};
