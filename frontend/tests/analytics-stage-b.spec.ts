import {test,expect,type Page} from "@playwright/test";
import fs from "node:fs";
import type {Comparison, Pair} from "../types/comparison";
const typeId="a0484269-bdac-4cc8-91a2-19f2302d604e";
const pipeline={pipeline_id:"retired",pipeline_name:"Historical OCR",retired:true};
const row={...pipeline,tests:6,successful_runs:6,failed_runs:0,evaluated_runs:6,cer:.2,min_cer:0,max_cer:.4,wer:.2,exact_match_rate:.5,avg_time_ms:1000,timed_runs:6,avg_gateway_time_ms:20,avg_confidence:.9};
const summary={test_cases:102,history_cases:85,latest_results:226,evaluated_results:92,evaluated_cases:52,evaluated_pipelines:1,coverage:52/102,
 minimum_samples:5,fastest_progress:6,fastest:row,lowest_cer_ties:6,
 lowest_cer:{cer:0,...pipeline,run_id:"run-1",test_case_id:"saved",filename:"synthetic.png",page_number:null,evaluated_at:"2026-09-29T09:39:57Z",date_source:"evaluation",evaluation_mode:"per_field",href:"/test/saved"}};
const caseRecord={id:"saved",created_at:"2026-09-29T00:00:00Z",categories:[{id:"tag",code:"thai_text",display_name:"ข้อความภาษาไทย"}],ground_truth_raw:"ก",document:{id:"doc",filename:"synthetic.png",page_count:1,document_type_name:"บัตรประชาชนไทย"},runs:[{id:"run-1",...pipeline,status:"success",metrics:{cer:0},processing_time_ms:1000,confidence:.9}]};
const active=[{pipeline_id:"a",pipeline_name:"Active A",active:true,retired:false},{pipeline_id:"b",pipeline_name:"Active B",active:true,retired:false}];
const pair:Pair={a:"a",b:"b",documents:5,test_cases:8,mean_cer_a:.02,mean_cer_b:.03,mean_dcer_pp:-1,ci95_pp:[-2,1],wins:3,ties:1,losses:1,winner:null,verdict:"inconclusive"};
function decisionFixture(archived=false):Comparison{
 const identities=archived?[...active,{...pipeline,active:false}]:active;
 const cells=identities.map(i=>({...i,cer:.02,documents:5,timed_runs:8,time_seconds:1}));
 const overall={recommendation:null,ranking:active.map(i=>({...i,score:0,mean_pair_dcer_pp:-1})),featured_pair:pair,pairs:[pair],historical_pairs:[],documents:10,cells,readiness:{x:8,y:12,documents:5,valid_pair:true,reason:null,reasons:{missing_gt:2,not_run:1,failed:1,other:0}},scatter:{points:cells.map(c=>({...c,filled:c.active,pareto:c.active,cohort_mode:c.active?"common":"own"})),common_documents:5,common_test_cases:8,cohort_mode:"common",pareto_valid:true}};
 return {scope:{},include_archived:archived,pipelines:identities,overall,by_type:[{code:"all",name:"ทุกประเภท",archived:false,documents:10,decision:overall},{code:"unassigned",name:"ไม่ระบุประเภท",archived:false,documents:10,decision:overall}],latest_results:16,minimum_documents:5,tie_pp:.05,bootstrap_samples:2000,statistical_unit:"document",computation_ms:1,actions:{missing_gt:2,missing_runs:[{...active[0],count:1}],failed_runs:[{...active[1],count:1}],short_types:[],largest_spread:[{test_case_id:"saved",filename:"synthetic.png",href:"/test/saved",spread:.1,best_cer:.2}],hardest:[]}};
}
async function fixtures(page:Page) {
 await page.route("**/api/**",async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204});
  if(path==="/api/analytics/summary")return route.fulfill({json:summary});
  if(path==="/api/analytics/pipelines")return route.fulfill({json:[...active,pipeline]});
  if(path==="/api/analytics/comparison")return route.fulfill({json:decisionFixture(url.searchParams.get("include_archived")==="1")});
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

for(const width of [1440,390])test(`decision support and archived display invariant ${width}`,async({page})=>{
 await fixtures(page);await page.setViewportSize({width,height:1050});await page.goto("/matrix");
 await expect(page.getByRole("tab",{name:"สรุปผล",exact:true})).toHaveAttribute("aria-selected","true");
 const card=page.getByLabel("คำแนะนำปัจจุบัน");
 await expect(card).toContainText("ยังตัดสินผู้ชนะไม่ได้");
 await expect(page.getByTestId("comparison-simple-cards").locator("section")).toHaveCount(3);
 await expect(card).toContainText("5 เอกสาร");
 await expect(page.getByTestId("comparison-simple-cards")).toContainText("ยืนยัน Ground Truth อีก 2 ชุด");
 await expect(page.getByRole("table",{name:"หลักฐานการเทียบคู่"}).first()).not.toBeVisible();
 const text=await card.innerText();await page.getByLabel("เฉพาะ Pipeline ที่ใช้งานอยู่",{exact:true}).uncheck();
 await expect(page.locator("main .loading-state")).toHaveCount(0);await expect(card).toHaveText(text,{useInnerText:true});
 await expect(page.getByRole("combobox",{name:"Pipeline A",exact:true}).locator("option")).toContainText(["เลือก Pipeline","Active A","Active B","Historical OCR (เก็บถาวร)"]);
 await expect(page.locator('#console-navigation a[href^="/matrix"]')).toHaveCount(1);
 await expect(page.locator('#console-navigation a[href^="/analytics/categories"]')).toHaveCount(0);
 await page.getByText("ผลรายชุดทดสอบ",{exact:true}).click();
 await expect(page.getByRole("link",{name:"synthetic.png",exact:true}).first()).toHaveAttribute("href","/test/saved");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.getByText("ผลรายชุดทดสอบ",{exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`../.runtime/comparison-review/local-overall-${width}.png`,fullPage:true});
});

test("shared business/pipeline/creation-date URL scope persists and local controls stay local",async({page})=>{
 await fixtures(page);await page.goto("/history");
 await page.getByLabel("ประเภทเอกสาร (ธุรกิจ)").selectOption(typeId);
 await page.getByLabel("Pipeline",{exact:true}).selectOption("retired");
 await page.getByLabel("วันที่สร้างชุดทดสอบ · จากวันที่").fill("2026-09-01");
 await page.getByLabel("วันที่สร้างชุดทดสอบ · ถึงวันที่").fill("2026-10-01");
 await page.getByLabel("ค้นหาในหน้านี้",{exact:true}).fill("synthetic");
 const scope=new URL(page.url()).search;
 for(const name of ["เปรียบเทียบ","ประวัติ"]){
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

for(const width of [1440,390])test(`by-type heatmap and legacy redirect ${width}`,async({page})=>{
 await fixtures(page);await page.setViewportSize({width,height:1050});
 await page.goto(`/analytics/categories?document_type_id=${typeId}&pipeline=a&date_from=2026-09-01&date_to=2026-10-01&include_archived=1`);
 await expect.poll(()=>new URL(page.url()).pathname).toBe("/matrix");
 const params=new URL(page.url()).searchParams;expect(params.get("view")).toBe("by-type");expect(params.get("include_archived")).toBe("1");expect(params.get("document_type_id")).toBe(typeId);expect(params.get("pipeline")).toBe("a");expect(params.get("date_from")).toBe("2026-09-01");expect(params.get("date_to")).toBe("2026-10-01");
 await expect(page.getByRole("tab",{name:"ตามประเภทเอกสาร",exact:true})).toHaveAttribute("aria-selected","true");
 await expect(page.getByLabel("คำแนะนำตามประเภทเอกสาร")).toContainText("ทุกประเภท");
 await page.getByText("ดูตารางทุก Pipeline",{exact:true}).click();
 const heatmap=page.getByRole("table",{name:"เปรียบเทียบตามประเภทเอกสาร",exact:true});await expect(heatmap).toContainText("ทุกประเภท");await expect(heatmap).toContainText("ไม่ระบุประเภท");await expect(heatmap).toContainText("n=5");await expect(heatmap).not.toContainText("★");await expect(heatmap).toContainText("ยังไม่มีผู้ชนะชัดเจน");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`../.runtime/comparison-review/local-by-type-${width}.png`,fullPage:true});
});

for(const route of ["/history","/matrix","/analytics/categories","/dataset"])test(`obsolete filters are removed and never sent to APIs: ${route}`,async({page})=>{
 const requested:URL[]=[];
 page.on("request",request=>{const url=new URL(request.url());if(url.pathname.startsWith("/api/"))requested.push(url);});
 await fixtures(page);await page.goto(`${route}?category=thai_text&document=hidden-uuid`);
 await expect(page.locator("main h1")).toBeVisible();
 await expect(page.locator("main .loading-state")).toHaveCount(0);
 await expect.poll(()=>new URL(page.url()).searchParams.has("category")||new URL(page.url()).searchParams.has("document")).toBe(false);
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
  await expect(page.getByRole("checkbox").last()).toBeEnabled();
  await page.getByRole("checkbox").first().check();
  await expect(page.getByRole("button",{name:"ส่งออก ZIP (1 ที่พร้อม)"})).toBeEnabled();
  await page.screenshot({path:"../.runtime/simplification-after/local-dataset-1440.png",fullPage:true});
 }
 if(route==="/history")await page.screenshot({path:"../.runtime/simplification-after/local-history-1440.png",fullPage:true});
});

test("failed OCR uses a readable state without developer log navigation",async({page})=>{
 await fixtures(page);
 await page.route("**/api/history*",route=>route.fulfill({json:[{...caseRecord,runs:[{...caseRecord.runs[0],status:"error"}]}]}));
 await page.goto("/matrix?include_archived=1");
 await page.getByText("ผลรายชุดทดสอบ",{exact:true}).click();
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

test("clear recommendation copy and Pareto absent on unmatched cohorts",async({page})=>{
 await fixtures(page);const data=decisionFixture();data.overall.recommendation="a";data.overall.featured_pair={...pair,winner:"a",verdict:"clear",ci95_pp:[-2,-.5]};data.overall.pairs=[data.overall.featured_pair];data.overall.scatter.pareto_valid=false;data.overall.scatter.cohort_mode="own";
 await page.route("**/api/analytics/comparison*",r=>r.fulfill({json:data}));await page.goto("/matrix");
 await expect(page.getByLabel("คำแนะนำปัจจุบัน")).toContainText("แนะนำตอนนี้");await expect(page.getByLabel("คำแนะนำปัจจุบัน")).toContainText("Active A");await page.getByText("รายละเอียดเพิ่มเติม",{exact:true}).click();await page.getByText("ความแม่นยำ × เวลา",{exact:true}).first().click();await expect(page.locator("main")).toContainText("ชุดเอกสารไม่ตรงกัน เทียบกันตรง ๆ ไม่ได้");await expect(page.getByTestId("pareto-frontier")).toHaveCount(0);
 await page.getByRole("tab",{name:"ตามประเภทเอกสาร",exact:true}).click();await expect.poll(()=>new URL(page.url()).searchParams.get("view")).toBe("by-type");
});

test("manual pair only changes inspection and never system decision",async({page})=>{
 await fixtures(page);await page.goto("/matrix");const hero=page.getByTestId("comparison-hero"),before=await hero.innerText();
 await page.getByRole("combobox",{name:"Pipeline A",exact:true}).selectOption("b");await expect(page.getByLabel("เปรียบเทียบสอง Pipeline โดยตรง")).toContainText("เลือก Pipeline คนละตัว");await expect(hero).toHaveText(before,{useInnerText:true});
 await page.getByRole("combobox",{name:"Pipeline B",exact:true}).selectOption("a");await expect(page.getByLabel("เปรียบเทียบสอง Pipeline โดยตรง")).toContainText("สูสี ยังสรุปไม่ได้");await expect(hero).toHaveText(before,{useInnerText:true});
 await expect(page.getByRole("table",{name:"หลักฐานการเทียบคู่"}).first()).not.toBeVisible();await page.getByText("ดูหลักฐานเชิงสถิติ",{exact:true}).click();await expect(page.getByRole("table",{name:"หลักฐานการเทียบคู่"}).first()).toContainText("5 / 8");
});
for(const width of [1440,390])test(`fresh Comparison has honest empty state ${width}`,async({page})=>{
 await fixtures(page);const data=decisionFixture();data.latest_results=0;data.pipelines=[];data.overall={...data.overall,recommendation:null,ranking:[],featured_pair:null,pairs:[],historical_pairs:[],documents:0,cells:[]};
 await page.route("**/api/analytics/comparison*",r=>r.fulfill({json:data}));await page.route("**/api/history*",r=>r.fulfill({json:[]}));await page.setViewportSize({width,height:1050});await page.goto("/matrix");
 await expect(page.getByTestId("comparison-hero")).toContainText("ยังไม่มีข้อมูลสำหรับเปรียบเทียบ");await expect(page.getByTestId("comparison-hero")).toContainText("เริ่มจากทดสอบ OCR และยืนยัน Ground Truth");await expect(page.getByTestId("comparison-simple-cards").locator("section")).toHaveCount(3);
 await expect(page.getByRole("img",{name:"กราฟ CER เฉลี่ยกับเวลาเฉลี่ยต่อชุดทดสอบ"})).toHaveCount(0);await expect(page.locator("main")).not.toContainText(/NaN|undefined|0\/0/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
test("System Logs explicitly reports disabled persistence",async({page})=>{
 await fixtures(page);await page.route("**/api/logs*",r=>r.fulfill({json:{enabled:false,total:0,items:[]}}));await page.goto("/logs");await expect(page.locator("main")).toContainText("ไม่ได้เปิดการบันทึก System Logs ลงฐานข้อมูล");await expect(page.locator("tbody tr")).toHaveCount(0);
});
