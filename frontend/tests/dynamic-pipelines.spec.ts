import { test, expect } from "@playwright/test";
import type { OCRModel, PipelineConfig } from "../types";

for (const width of [1440, 768]) {
  test(`create, edit and compose dynamic pipelines at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const pipelines: PipelineConfig[] = [];
    const models: OCRModel[] = [
      { id: "det6", name: "DET V6", kind: "det", source: "custom", version: "6", weight: "baseline", single_path: "", batch_path: "/api/v1/text-detection-batches?version=6&model=baseline" },
      { id: "rec5", name: "REC V5", kind: "rec", source: "custom", version: "5", weight: "thai_ft_v2", single_path: "", batch_path: "/api/v1/text-recognition-batches?version=5&model=thai_ft_v2" },
    ];
    const errors: string[] = [];
    let gatewayChecks = 0;
    let failDelete = false;
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/api/**", async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (req.method() === "DELETE") {
        if(failDelete)return route.fulfill({status:503,json:{detail:"Delete failed"}});
        const index=pipelines.findIndex(p=>path.endsWith(p.pipeline_id));
        if(index>=0)pipelines.splice(index,1);
        return route.fulfill({status:204});
      }
      if (path.endsWith("/test-connection")) {
        gatewayChecks++;
        return route.fulfill({ json: { status: gatewayChecks === 1 ? "gateway_connected" : "unavailable", message: "Gateway check" } });
      }
      if (path === "/api/pipelines/models") {
        if (req.method() === "POST") {
          const model = { ...req.postDataJSON(), id: "new-model" };
          models.push(model);
          return route.fulfill({ json: model, status: 201 });
        }
        return route.fulfill({ json: models });
      }
      if(path.startsWith("/api/pipelines/models/") && req.method()==="PUT"){
        const model=models.find(m=>path.endsWith(m.id))!;
        Object.assign(model,req.postDataJSON());
        return route.fulfill({json:model});
      }
      if (path === "/api/pipelines" || path.endsWith("/definition")) {
        if (req.method() !== "GET") {
          const body = req.postDataJSON();
          const index = req.method() === "PUT" ? pipelines.findIndex(p => path.includes(p.pipeline_id)) : -1;
          const pipeline = { ...body, id: "id", pipeline_id: index >= 0 ? pipelines[index].pipeline_id : `dynamic_${pipelines.length}`,
            integrated_options: body.execution_mode === "integrated" ? { version: body.version, det_weight: body.det_weight, rec_weight: body.rec_weight } : null,
            det_model: models.find(m => m.id === body.det_model_id), rec_model: models.find(m => m.id === body.rec_model_id) };
          if (index >= 0) pipelines[index] = pipeline; else pipelines.push(pipeline);
          return route.fulfill({ json: pipeline, status: index >= 0 ? 200 : 201 });
        }
        return route.fulfill({ json: pipelines });
      }
      return route.fulfill({ json: { gateway: "connected", database: { provider: "sqlite", status: "connected" } } });
    });
    await page.goto("/settings/pipelines");
    await page.getByRole("button", { name: "เพิ่ม Pipeline", exact: true }).click();
    await expect(page.locator("form[data-execution-mode]")).toHaveAttribute("data-execution-mode", "det_rec");
    await expect(page.getByRole("combobox", { name: "2. วิธีทำงาน" })).toHaveCount(0);
    await page.getByLabel("ชื่อ Pipeline", { exact: true }).fill("Custom V6 test");
    const det = page.getByRole("group", { name: "2. Text Detection", exact: true });
    const rec = page.getByRole("group", { name: "3. Text Recognition", exact: true });
    await det.getByRole("combobox", { name: "Model version", exact: true }).selectOption("6");
    await det.getByRole("combobox", { name: "Weight / โมเดล", exact: true }).selectOption("det6");
    await rec.getByRole("combobox", { name: "Model version", exact: true }).selectOption("5");
    await page.screenshot({path:`test-results/pipeline-editor-${width}.png`,fullPage:true});
    await rec.getByRole("combobox", { name: "Weight / โมเดล", exact: true }).selectOption("rec5");
    await page.getByRole("button", { name: "บันทึก Pipeline", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Custom V6 test" })).toBeVisible();
    await expect(page.getByText("Engine pipeline custom")).toBeVisible();
    await expect(page.getByText("DET V6 / baseline", { exact: true })).toBeVisible();
    await expect(page.getByText("REC V5 / thai_ft_v2", { exact: true })).toBeVisible();
    await expect(page.getByText("พร้อมใช้งาน · Gateway", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "ทดสอบ Gateway", exact: true }).click();
    await expect(page.getByText("พร้อมใช้งาน · Gateway", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "ทดสอบ Gateway", exact: true }).click();
    await expect(page.getByText("พร้อมใช้งาน · Gateway", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
    await page.getByLabel("ชื่อ Pipeline", { exact: true }).fill("Renamed OCR");
    await expect(rec.getByRole("combobox", { name: "Model version", exact: true })).toHaveValue("5");
    await page.getByRole("button", { name: "บันทึก Pipeline", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Renamed OCR" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Renamed OCR" })).toBeVisible();
    expect(pipelines[0].execution_mode).toBe("det_rec");
    await expect(page.getByText("พร้อมใช้งาน · Gateway", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "เพิ่ม Pipeline", exact: true }).click();
    await page.getByLabel("ชื่อ Pipeline", { exact: true }).fill("Separate stages");
    await det.getByRole("combobox", { name: "Model version", exact: true }).selectOption("6");
    await det.getByLabel("Weight / โมเดล").selectOption("det6");
    await rec.getByRole("combobox", { name: "Model version", exact: true }).selectOption("5");
    await rec.getByLabel("Weight / โมเดล").selectOption("rec5");
    await page.getByRole("button", { name: "บันทึก Pipeline", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Separate stages" })).toBeVisible();
    expect(pipelines[1].det_model_id).toBe("det6");
    expect(pipelines[1].rec_model_id).toBe("rec5");
    await page.getByText("จัดการโมเดล OCR · เพิ่ม / แก้ไข API Path", { exact: true }).click();
    await page.getByRole("button", { name: "เพิ่มโมเดล", exact: true }).click();
    await page.getByLabel("ชื่อที่แสดง", { exact: true }).fill("New detector");
    await page.getByRole("button", { name: "บันทึกโมเดล", exact: true }).click();
    await expect.poll(() => models.length).toBe(3);
    const originalPath=models[0].batch_path,originalWeight=models[0].weight;
    await page.getByText("จัดการโมเดล OCR · เพิ่ม / แก้ไข API Path", {exact:true}).click();
    await page.getByRole("button",{name:"แก้ไขโมเดล DET V6",exact:true}).click();
    await page.getByLabel("ชื่อที่แสดง",{exact:true}).fill("My detector");
    await page.getByRole("button",{name:"บันทึกโมเดล",exact:true}).click();
    await expect.poll(()=>models[0].name).toBe("My detector");
    expect(models[0].batch_path).toBe(originalPath);
    expect(models[0].weight).toBe(originalWeight);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/dynamic-pipelines-${width}.png`, fullPage: true });
    await expect(page.getByText("Pipeline เดิม",{exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"ลบ Pipeline Renamed OCR",exact:true}).click();
    await page.getByRole("button",{name:"ยกเลิก",exact:true}).click();
    expect(pipelines).toHaveLength(2);
    await page.getByRole("button",{name:"ลบ Pipeline Renamed OCR",exact:true}).click();
    failDelete=true;
    await page.getByRole("button",{name:"ยืนยันลบ Pipeline",exact:true}).click();
    await expect(page.locator('.error-banner[role="alert"]')).toBeVisible();
    await expect(page.getByRole("heading",{name:"Renamed OCR",exact:true})).toBeVisible();
    failDelete=false;
    await page.getByRole("button",{name:"ยืนยันลบ Pipeline",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Renamed OCR",exact:true})).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading",{name:"Separate stages",exact:true})).toBeVisible();
    expect(pipelines).toHaveLength(1);
  });
}
