import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Existing workflow regressions now enter via a legacy record, not the redesigned home. */
export async function openLegacyWorkspace(page: Page) {
 const api=process.env.E2E_API_URL||"http://127.0.0.1:8100";
 const uploaded=await page.request.post(`${api}/api/documents`,{multipart:{file:{name:"legacy-compatibility.png",mimeType:"image/png",buffer:fs.readFileSync(path.resolve("public/sample-document.png"))}}});
 expect(uploaded.ok()).toBeTruthy();const document=await uploaded.json();
 const response=await page.request.post(`${api}/api/test-cases`,{data:{document_id:document.id,workflow:"legacy"}});
 expect(response.ok()).toBeTruthy();const saved=await response.json();
 await page.goto(`/?testCase=${saved.id}`);
 await expect(page.getByText("ประวัติแบบเดิม — คง ROI, ข้อความ และผลประเมินตามที่บันทึกไว้")).toBeVisible();
 await expect(page.getByTestId("document-viewer")).toBeVisible();
}
