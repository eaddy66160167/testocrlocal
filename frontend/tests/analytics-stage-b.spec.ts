import {test,expect,type Page} from "@playwright/test";
import fs from "node:fs";
const typeId="a0484269-bdac-4cc8-91a2-19f2302d604e";
const pipeline={pipeline_id:"retired",pipeline_name:"Historical OCR",retired:true};
const row={...pipeline,tests:6,successful_runs:6,failed_runs:0,evaluated_runs:6,cer:.2,min_cer:0,max_cer:.4,wer:.2,exact_match_rate:.5,avg_time_ms:1000,timed_runs:6,avg_gateway_time_ms:20,avg_confidence:.9};
const summary={test_cases:102,history_cases:85,latest_results:226,evaluated_results:92,evaluated_cases:52,evaluated_pipelines:1,coverage:52/102,
 minimum_samples:5,fastest_progress:6,fastest:row,lowest_cer_ties:6,
 lowest_cer:{cer:0,...pipeline,run_id:"run-1",test_case_id:"saved",filename:"synthetic.png",page_number:null,evaluated_at:"2026-09-29T09:39:57Z",date_source:"evaluation",evaluation_mode:"per_field",href:"/test/saved"}};
const caseRecord={id:"saved",created_at:"2026-09-29T00:00:00Z",categories:[{id:"tag",code:"thai_text",display_name:"ข้อความภาษาไทย"}],ground_truth_raw:"ก",document:{id:"doc",filename:"synthetic.png",page_count:1,document_type_name:"บัตรประชาชนไทย"},runs:[{id:"run-1",...pipeline,status:"success",metrics:{cer:0},processing_time_ms:1000,confidence:.9}]};
async function fixtures(page:Page) {
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204});
  if(path==="/api/analytics/summary")return route.fulfill({json:summary});
  if(path==="/api/analytics/pipelines")return route.fulfill({json:[pipeline]});
  if(path==="/api/categories")return route.fulfill({json:[{id:"tag",code:"thai_text",display_name:"ข้อความภาษาไทย"}]});
  if(path==="/api/document-types")return route.fulfill({json:[{id:typeId,name:"บัตรประชาชนไทย",active:true,system:true}]});
  if(path==="/api/history")return route.fulfill({json:[caseRecord]});
  if(path==="/api/documents/doc/crop")return route.fulfill({contentType:"image/png",body:fs.readFileSync("public/sample-document.png")});
  if(path==="/api/matrix")return route.fulfill({json:[row]});
  if(path.startsWith("/api/analytics/"))return route.fulfill({json:[{...summary,code:path.endsWith("categories")?"thai_text":typeId,display_name:path.endsWith("categories")?"ข้อความภาษาไทย":"บัตรประชาชนไทย",test_cases:2,evaluated_cases:1,evaluated_results:2,lowest_cer:null,lowest_cer_ties:0,fastest:null,best_pipeline:null,pipelines:[{...row,tests:2,evaluated_runs:2,successful_runs:2,timed_runs:2}]}]});
  if(path==="/api/logs")return route.fulfill({json:{total:2,items:[true,false].map((exists,i)=>({id:String(i),created_at:"2026-09-29T00:00:00Z",level:i?"ERROR":"INFO",event_type:i?"ocr_run_error":"ocr_run_success",message:i?"OCR ผิดพลาด":"OCR สำเร็จ",outcome:i?"error":"success",pipeline_id:"retired",pipeline_name:"Historical OCR",document_id:"doc",document_name:"synthetic.png",test_case_id:i?"deleted":"saved",test_case_exists:exists,page_number:1,request_id:"safe-request",gateway_request_id:null,metadata:{duration_ms:3800}}))}});
  if(path==="/api/dataset/samples")return route.fulfill({json:{total:2,items:[true,false].map((available,i)=>({id:`sample-${i}`,document_id:"doc",filename:"synthetic.png",page_number:null,roi:{x1:0,y1:0,x2:100,y2:50},ground_truth_raw:"ก",categories:["thai_text"],document_type_name:"บัตรประชาชนไทย",source_available:available}))}});
  return route.fulfill({json:[]});
 });
}

for(const width of [1440,390])test(`KPI complete scope and archived provenance ${width}`,async({page})=>{
 await fixtures(page);await page.setViewportSize({width,height:1050});await page.goto("/matrix");
 const kpis=page.getByLabel("KPI ตามขอบเขตตัวกรองร่วม");
 await expect(kpis).toContainText("102");await expect(kpis).toContainText("92");await expect(kpis).toContainText("51.0%");
 await expect(kpis).toContainText("0.0%");await expect(kpis).toContainText("มีผล CER เท่ากันอีก 6 ผล");
 await expect(kpis.getByRole("link",{name:"ดูผลต้นทาง"})).toHaveAttribute("href","/test/saved");
 await expect(kpis).toContainText("6 runs สำเร็จ");await expect(page.locator("main")).toContainText("เก็บถาวร");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`../.runtime/simplification-after/local-comparison-${width}.png`,fullPage:true});
});

test("shared business/pipeline/creation-date URL scope persists and local controls stay local",async({page})=>{
 await fixtures(page);await page.goto("/history");
 await page.getByLabel("ประเภทเอกสาร (ธุรกิจ)").selectOption(typeId);
 await page.getByLabel("Pipeline",{exact:true}).selectOption("retired");
 await page.getByLabel("วันที่สร้างชุดทดสอบ · จากวันที่").fill("2026-09-01");
 await page.getByLabel("วันที่สร้างชุดทดสอบ · ถึงวันที่").fill("2026-10-01");
 await page.getByLabel("ค้นหาในหน้านี้",{exact:true}).fill("synthetic");
 const scope=new URL(page.url()).search;
 for(const name of ["เปรียบเทียบ","วิเคราะห์","ประวัติ"]){
  await page.getByRole("navigation",{name:"เมนูหลัก"}).getByRole("link",{name,exact:true}).click();
  await expect.poll(()=>new URL(page.url()).search).toBe(scope);
  await expect(page.getByLabel("ประเภทเอกสาร (ธุรกิจ)")).toHaveValue(typeId);
 }
 await expect(page.getByLabel("ค้นหาในหน้านี้",{exact:true})).toHaveValue("");
 await expect(page.locator("tbody")).toContainText("Historical OCR");
 await expect(page.locator("tbody")).toContainText("เก็บถาวร");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"}).getByRole("link",{name:"บันทึกระบบ",exact:true})).toHaveCount(0);
 await page.goto("/logs");
 await expect.poll(()=>new URL(page.url()).search).toBe("");
});

for(const width of [1440,390])test(`Business Analysis and insufficient group ranking ${width}`,async({page})=>{
 await fixtures(page);await page.setViewportSize({width,height:1050});await page.goto("/analytics/categories");
 await expect(page.getByRole("heading",{name:"วิเคราะห์ประสิทธิภาพ",exact:true})).toBeVisible();
 await expect(page.getByRole("group",{name:"มิติการวิเคราะห์"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"ตามประเภทข้อมูล",exact:true})).toHaveCount(0);
 await expect(page.locator("main")).toContainText("ยังมีข้อมูลไม่พอสำหรับเปรียบเทียบ");
 await expect(page.locator("tbody")).toContainText("Historical OCR");
 await expect(page.locator("tbody")).toContainText("เก็บถาวร");
 await expect(page.getByLabel("ประเภทที่แสดงในตาราง")).toHaveValue(typeId);
 await expect(page.getByRole("link",{name:"ดูประวัติของประเภทนี้"})).toHaveAttribute("href",`/history?document_type_id=${typeId}`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`../.runtime/simplification-after/local-analysis-${width}.png`,fullPage:true});
});

for(const route of ["/history","/matrix","/analytics/categories","/dataset"])test(`obsolete filters are removed and never sent to APIs: ${route}`,async({page})=>{
 const requested:URL[]=[];
 page.on("request",request=>{const url=new URL(request.url());if(url.pathname.startsWith("/api/"))requested.push(url);});
 await fixtures(page);await page.goto(`${route}?category=thai_text&document=hidden-uuid`);
 await expect(page.locator("main h1")).toBeVisible();
 await expect(page.locator("main .loading-state")).toHaveCount(0);
 await expect.poll(()=>new URL(page.url()).search).toBe("");
 await expect(page.getByLabel("ประเภทข้อมูล",{exact:true})).toHaveCount(0);
 await expect(page.getByLabel("Document ID",{exact:true})).toHaveCount(0);
 await expect(page.locator('main a[href^="/logs"]')).toHaveCount(0);
 await expect(page.locator('main')).not.toContainText("ข้อความภาษาไทย");
 await expect(page.locator('#console-navigation a[href="/logs"]')).toHaveCount(0);
 expect(requested.length).toBeGreaterThan(0);
 expect(requested.every(url=>!url.searchParams.has("category")&&!url.searchParams.has("document"))).toBeTruthy();
 expect(requested.some(url=>["/api/categories","/api/analytics/categories"].includes(url.pathname))).toBeFalsy();
 if(route==="/dataset"){
  await expect(page.getByRole("checkbox").first()).toBeEnabled();
  await expect(page.getByRole("checkbox").last()).toBeDisabled();
  await page.getByRole("checkbox").first().check();
  await expect(page.getByRole("button",{name:"ส่งออก ZIP (1)"})).toBeEnabled();
  await page.screenshot({path:"../.runtime/simplification-after/local-dataset-1440.png",fullPage:true});
 }
 if(route==="/history")await page.screenshot({path:"../.runtime/simplification-after/local-history-1440.png",fullPage:true});
});

test("failed OCR uses a readable state without developer log navigation",async({page})=>{
 await fixtures(page);
 await page.route("**/api/history*",route=>route.fulfill({json:[{...caseRecord,runs:[{...caseRecord.runs[0],status:"error"}]}]}));
 await page.goto("/matrix");
 await expect(page.getByRole("table",{name:"เปรียบเทียบรายชุดทดสอบ"})).toContainText("ประมวลผลไม่สำเร็จ");
 await expect(page.locator('main a[href^="/logs"]')).toHaveCount(0);
 await expect(page.locator('main')).not.toContainText("request_id");
});

test("human logs expand technical details and deleted references have no broken link",async({page})=>{
 await fixtures(page);await page.goto("/logs");
 const rows=page.locator("tbody tr");await expect(rows).toHaveCount(2);
 await expect(rows.first()).toContainText("ข้อมูล");await expect(rows.first()).toContainText("OCR สำเร็จ");
 await expect(rows.first()).toContainText("3.8 วินาที");
 await expect(rows.first().getByRole("link",{name:"เปิดชุดทดสอบ"})).toHaveAttribute("href","/test/saved");
 await expect(rows.last()).toContainText("ไม่พบรายการ (ถูกลบแล้ว)");await expect(rows.last().getByRole("link")).toHaveCount(0);
 await expect(rows.first().locator("details")).not.toHaveAttribute("open","");
 await rows.first().locator("summary").click();await expect(rows.first()).toContainText("safe-request");
 await page.screenshot({path:"../.runtime/simplification-after/local-logs-1440.png",fullPage:true});
});
