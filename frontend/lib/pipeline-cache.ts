import { localDB, type ConfigEntry } from "./local-db/schema";
const pending = new Map<string, Promise<ConfigEntry>>();
export async function configuration<T>(path: string, base: string): Promise<T> {
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
      await db.config.put(entry); return entry;
    })(); pending.set(id, promise);
  }
  try { return (await promise).value as T; } finally { pending.delete(id); }
}
export const invalidateConfiguration = async () => localDB().config.clear();
