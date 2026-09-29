import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import type { TestCase, PipelineRun } from "../types";
const api=process.env.E2E_API_URL||"http://127.0.0.1:8100";
const ids=['mint','hutch_crop','hutch_full','benchmark','thai_ft_v2','hutch_fine_tune_v2'];
async function upload(page:Page,pdf=false){
 await page.goto('/');await expect(page.getByTestId('workflow-upload')).toBeVisible();
 const pending=page.waitForResponse(r=>r.url().endsWith('/api/documents')&&r.request().method()==='POST');
 await page.locator('input[type=file]').setInputFiles(path.resolve(pdf?'tests/fixtures/two-pages.pdf':'public/sample-document.png'));
 const doc=await(await pending).json();await expect(page.getByAltText('เอกสารที่อัปโหลด')).toBeVisible();
 await expect(page.getByRole('button',{name:'Run OCR',exact:true})).toHaveCount(0);await expect(page.locator('textarea')).toHaveCount(0);
 await page.getByRole('button',{name:'ถัดไป: จัดการ Layout',exact:true}).click();await expect(page).toHaveURL(/\/workflow\/[^/]+\/layout$/);await expect(page.getByTestId('document-viewer').locator('canvas').first()).toBeVisible();return doc;
}
async function detect(page:Page){await page.getByRole('button',{name:'Auto Layout',exact:true}).click();await expect(page.getByTestId('global-field-nav')).toHaveCount(3);await expect(page.getByLabel('Auto Layout suggestions')).toHaveCount(0);}
async function confirm(page:Page){
 const pending=page.waitForResponse(r=>r.url().endsWith('/global-fields')&&r.request().method()==='PUT');
 await page.getByRole('button',{name:'ยืนยัน ROI',exact:true}).click();const response=await pending;expect(response.status()).toBe(200);await expect(page).toHaveURL(/\/pipelines$/);await expect(page.getByRole('button',{name:'เพิ่มกรอบ Manual',exact:true})).toHaveCount(0);return await response.json() as TestCase;
}
async function run(page:Page){
 const pending=page.waitForResponse(r=>r.url().endsWith('/run')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Run OCR',exact:true}).click();const result=await(await pending).json();
 expect(result.runs).toHaveLength(ids.length);expect(result.runs.every((r:PipelineRun)=>r.status==='success')).toBeTruthy();
 await expect(page).toHaveURL(/\/ground-truth$/);await expect(page.getByTestId('field-gt-input').first()).toBeVisible();return result;
}
async function draw(page:Page,a:[number,number],b:[number,number],w=1000,h=1320){
 await page.getByRole('button',{name:'เพิ่มกรอบ Manual',exact:true}).click();const canvas=page.getByTestId('document-viewer').locator('.konvajs-content');await canvas.scrollIntoViewIfNeeded();const box=(await canvas.boundingBox())!;
 const scale=Math.min((box.width-64)/w,(box.height-64)/h,1),x=box.x+(box.width-w*scale)/2,y=box.y+(box.height-h*scale)/2;
 await page.mouse.move(x+a[0]*scale,y+a[1]*scale);await page.mouse.down();await page.mouse.move(x+b[0]*scale,y+b[1]*scale,{steps:12});await page.mouse.up();
}
test.beforeEach(async({request})=>{for(const id of ids)expect((await request.put(`${api}/api/pipelines/${id}`,{data:{enabled:true}})).ok()).toBeTruthy();});

test('Hutch fine tune v2 shares four-page workflow, busy state and result blocks with Mint',async({page,request})=>{
 await upload(page);await detect(page);const c=await confirm(page);
 const options=page.getByTestId('pipeline-options');
 for(const label of ['Hutch Crop','Hutch Full','Benchmark','Thai FT v2'])await options.getByRole('checkbox',{name:`เลือก ${label}`,exact:true}).uncheck();
 const selected=options.getByRole('checkbox',{name:'เลือก Hutch fine tune v2',exact:true});await expect(selected).toBeChecked();
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/test-cases/*/run',async route=>{await gate;await route.continue();});
 await page.getByRole('button',{name:'Run OCR',exact:true}).click();await expect(selected).toBeDisabled();await expect(page.getByTestId('ocr-spinner')).toBeVisible();release();
 await expect(page).toHaveURL(/\/ground-truth$/);
 const card=page.getByTestId('global-result-hutch_fine_tune_v2');await expect(card).toContainText('Hutch fine tune v2');
 await expect(card.getByRole('region',{name:'Extracted Text',exact:true})).toBeVisible();await expect(card.getByRole('region',{name:'Metrics',exact:true})).toBeVisible();
 await page.getByLabel('Ground Truth Field 01').fill('ภาษาไทย');await page.getByRole('button',{name:'ยืนยันเพื่อคำนวณ',exact:true}).click();await expect(card.getByTestId('global-evaluation')).toBeVisible();await expect(card.getByText('Error Analysis',{exact:true})).toBeVisible();
 const saved=await(await request.get(`${api}/api/test-cases/${c.id}`)).json();expect(saved.runs.map((r:PipelineRun)=>r.pipeline_id).sort()).toEqual(['hutch_fine_tune_v2','mint']);
 await page.reload();await expect(card.getByTestId('global-evaluation')).toBeVisible();
});

test('Run OCR shows immediate busy feedback, blocks duplicates and restores after failure',async({page})=>{
 await upload(page);await detect(page);await confirm(page);
 let calls=0,release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/test-cases/*/run',async route=>{calls++;await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'OCR service temporarily unavailable'})});});
 await page.getByRole('button',{name:'Run OCR',exact:true}).click();
 const running=page.getByRole('button',{name:'กำลังรัน OCR...',exact:true});
 await expect(running).toBeDisabled();await expect(page.getByTestId('ocr-spinner')).toBeVisible();await expect(page.getByTestId('pipeline-options')).toHaveClass(/opacity-50/);
 for(const checkbox of await page.getByTestId('pipeline-options').getByRole('checkbox').all())await expect(checkbox).toBeDisabled();
 await running.evaluate((button:HTMLButtonElement)=>{button.click();button.click();});expect(calls).toBe(1);
 release();await expect(page.getByRole('button',{name:'Run OCR',exact:true})).toBeEnabled();await expect(page.getByTestId('pipeline-options')).toHaveClass(/opacity-100/);
 for(const checkbox of await page.getByTestId('pipeline-options').getByRole('checkbox').all())await expect(checkbox).toBeEnabled();
 await page.unroute('**/api/test-cases/*/run');await run(page);await expect(page.getByTestId('ocr-spinner')).toHaveCount(0);
});

test('GT input cards show focus and preserve both drafts across repeated toggles',async({page})=>{
 await upload(page);await detect(page);await confirm(page);await run(page);
 const sub=page.getByLabel('Ground Truth Field 01',{exact:true});await sub.fill('Sub-field draft');await sub.focus();await expect(sub).toBeFocused();
 await expect(page.getByTestId('field-gt-input').first()).toHaveCSS('border-top-width','1px');
 expect(await sub.evaluate(e=>getComputedStyle(e).boxShadow)).not.toBe('none');
 await page.getByRole('button',{name:'Whole Field',exact:true}).click();const whole=page.getByLabel('Ground Truth ทั้งเอกสาร',{exact:true});await whole.fill('Whole draft');await whole.focus();await expect(whole).toBeFocused();
 await expect(page.getByTestId('whole-gt-card')).toHaveCSS('border-top-width','1px');expect(await whole.evaluate(e=>getComputedStyle(e).boxShadow)).not.toBe('none');
 await page.getByRole('button',{name:'Sub-fields',exact:true}).click();await expect(sub).toHaveValue('Sub-field draft');await page.getByRole('button',{name:'Whole Field',exact:true}).click();await expect(whole).toHaveValue('Whole draft');await page.getByRole('button',{name:'Sub-fields',exact:true}).click();await expect(sub).toHaveValue('Sub-field draft');
});

test('global acceptance: 3 Auto + Manual, shared crops/GT, explicit calculate, History and field Dataset',async({page,request})=>{
 let runCalls=0;page.on('request',r=>{if(r.url().endsWith('/run'))runCalls++;});
 const doc=await upload(page);expect(runCalls).toBe(0);await expect(page.getByLabel('Ground Truth กลาง')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Run OCR',exact:true})).toHaveCount(0);
 await detect(page);
 await expect(page.getByTestId('global-field-nav')).toHaveCount(3);
 await draw(page,[80,800],[850,930]);await expect(page.getByTestId('global-field-nav')).toHaveCount(4);
 const c=await confirm(page);expect(c.global_fields).toHaveLength(4);expect(c.global_fields?.map(f=>f.source)).toEqual(['auto','auto','auto','manual']);
 expect((await(await request.get(`${api}/api/history?document=${doc.id}`)).json())).toEqual([]);
 await page.getByRole('button',{name:'Field 02',exact:true}).click();const result=await run(page);expect(runCalls).toBe(1);
 const fid=c.global_fields![1].id;
 const predictions=result.runs.map((r:PipelineRun)=>r.fields!.find(f=>f.global_field_id===fid)!);
 expect(new Set(predictions.map((f:{diagnostics:{input_sha256:string}})=>f.diagnostics.input_sha256)).size).toBe(1);
 await expect(page.getByTestId('global-result-mint').getByTestId('not-evaluated')).toBeVisible();
 for(const n of [1,3,4])await page.getByLabel(`ประเมิน Field ${String(n).padStart(2,'0')}`,{exact:true}).uncheck();
 await page.getByLabel('Ground Truth Field 02').fill('บริษัท ซีดีจี จำกัด\nABXD');
 await expect(page.getByTestId('global-evaluation')).toHaveCount(0);
 await page.getByRole('button',{name:'ยืนยันเพื่อคำนวณ',exact:true}).click();
 await expect(page).toHaveURL(/\/ground-truth$/);
 await page.getByTestId('global-field-nav').nth(1).click();
 await expect(page.getByTestId('global-result-mint').getByTestId('global-evaluation')).toBeVisible();
 await page.getByTestId('global-field-nav').nth(1).click();await page.getByTestId('global-result-mint').getByText('Error Analysis',{exact:true}).click(); await expect(page.getByTestId('global-result-mint').locator('[data-error-type=substitution]')).toHaveClass(/text-red-700/);
 for(const id of ids)await expect(page.getByTestId(`global-result-${id}`)).toContainText('CER');
 await page.reload();await expect(page.getByTestId('global-field-nav')).toHaveCount(4);await page.getByRole('button',{name:/^Field 02/}).click();
 await expect(page.getByTestId('confirmed-global-gt')).toContainText('ABXD');
 const reopened=await(await request.get(`${api}/api/test-cases/${c.id}`)).json();expect(reopened.global_fields.map((f:{id:string})=>f.id)).toEqual(c.global_fields!.map(f=>f.id));
 await page.screenshot({path:'test-results/global-results.png',fullPage:true});
 await page.goto(`/history?document=${doc.id}`);await page.locator(`a[href="/test/${c.id}"]`).first().click();await expect(page).toHaveURL(new RegExp(`/workflow/${c.id}/ground-truth$`));
 await page.goto('/dataset');await page.getByLabel('Document ID').fill(doc.id);const row=page.locator('tbody tr');await expect(row).toHaveCount(1);await expect(row).toContainText('Field 02');await expect(row).toContainText('ABXD');
 await page.getByRole('button',{name:'เลือกหน้านี้',exact:true}).click();const pending=page.waitForResponse(r=>r.url().endsWith('/dataset/export'));const download=page.waitForEvent('download');await page.getByRole('button',{name:'ส่งออก ZIP (1)',exact:true}).click();
 const response=await pending;expect(response.request().postDataJSON()).toEqual({test_case_ids:[],global_field_ids:[fid]});expect(await(await download).failure()).toBeNull();
});

test('smart calculation stays on page four and evaluates Whole/Sub/both from data, with collapsed cards',async({page,request})=>{
 const doc=await upload(page);await detect(page);const c=await confirm(page);const result=await run(page);
 const root=`${api}/api/test-cases/${c.id}`,mint=result.runs.find((r:PipelineRun)=>r.pipeline_id==='mint');
 const calculate=async()=>{const response=page.waitForResponse(r=>r.url().endsWith('/evaluate'));await page.getByRole('button',{name:'ยืนยันเพื่อคำนวณ',exact:true}).click();expect((await response).status()).toBe(200);await expect(page).toHaveURL(/\/ground-truth$/);};
 await expect(page.getByRole('button',{name:'ยืนยันเพื่อคำนวณ',exact:true})).toBeDisabled();
 // Whole-only, while the other editor is visible.
 await page.getByRole('button',{name:'Whole Field',exact:true}).click();await page.getByLabel('Ground Truth ทั้งเอกสาร',{exact:true}).fill(mint.final_text);
 await page.getByRole('button',{name:'Sub-fields',exact:true}).click();await calculate();
 let saved=await(await request.get(root)).json();expect(saved.runs.every((r:PipelineRun)=>r.document_evaluation)).toBeTruthy();expect(saved.runs.every((r:PipelineRun)=>r.fields!.every(f=>!f.evaluation))).toBeTruthy();expect((await(await request.get(`${api}/api/dataset/samples?document=${doc.id}`)).json()).total).toBe(0);
 // Sub-only after clearing Whole; select fields in reverse order.
 await page.getByRole('button',{name:'Whole Field',exact:true}).click();await page.getByLabel('Ground Truth ทั้งเอกสาร',{exact:true}).fill('');await page.getByRole('button',{name:'Sub-fields',exact:true}).click();
 for(const n of [1,2,3])await page.getByLabel(`ประเมิน Field 0${n}`,{exact:true}).uncheck();for(const n of [2,1])await page.getByLabel(`ประเมิน Field 0${n}`,{exact:true}).check();
 await expect(page.getByTestId('field-gt-input')).toHaveText(['Field 01','Field 02']);await page.getByLabel('Ground Truth Field 01').fill('บริษัท ซีดีจี จำกัด\nABXD');await page.getByLabel('Ground Truth Field 02').fill('บริษัท ซีดีจี จำกัด\nABXCD');await calculate();
 saved=await(await request.get(root)).json();expect(saved.runs.every((r:PipelineRun)=>!r.document_evaluation&&r.fields![0].evaluation&&r.fields![1].evaluation&&!r.fields![2].evaluation)).toBeTruthy();
 const card=page.getByTestId('global-result-mint');await expect(card.getByRole('region',{name:'Extracted Text',exact:true})).toBeVisible();await expect(card.getByRole('region',{name:'Metrics',exact:true})).toBeVisible();await expect(card.getByTestId('error-analysis')).not.toHaveAttribute('open','');await card.getByText('Error Analysis',{exact:true}).click();await expect(card.locator('[data-error-type=substitution]')).toHaveClass(/text-red-700/);
 await page.getByTestId('global-field-nav').nth(1).click();await card.getByText('Error Analysis',{exact:true}).click();await expect(card.locator('[data-error-type=deletion]')).toContainText('ขาด: X');
 // Both populated, hidden Whole draft survives toggles, ONE backend request.
 await page.getByRole('button',{name:'Whole Field',exact:true}).click();await page.getByLabel('Ground Truth ทั้งเอกสาร',{exact:true}).fill(mint.final_text+' EXTRA');await page.getByRole('button',{name:'Sub-fields',exact:true}).click();await page.getByLabel('Ground Truth Field 02').fill('บริษัท ซีดีจี จำกัด\nABD');
 await page.getByRole('button',{name:'Whole Field',exact:true}).click();await expect(page.getByLabel('Ground Truth ทั้งเอกสาร',{exact:true})).toHaveValue(mint.final_text+' EXTRA');await page.getByRole('button',{name:'Sub-fields',exact:true}).click();let calls=0;page.on('request',r=>{if(r.url().endsWith('/evaluate'))calls++;});await calculate();expect(calls).toBe(1);
 saved=await(await request.get(root)).json();expect(saved.runs.every((r:PipelineRun)=>r.document_evaluation&&r.fields![1].evaluation)).toBeTruthy();await expect(card.locator('[data-error-type=insertion]')).toHaveClass(/text-red-700/);
 await page.getByRole('button',{name:'Whole Field',exact:true}).click();await card.getByText('Error Analysis',{exact:true}).click();await expect(card.locator('[data-error-type=deletion]')).toHaveCount(6);for(const marker of await card.locator('[data-error-type=deletion]').all())await expect(marker).toBeVisible();expect(calls).toBe(1);
 await page.goto(`/workflow/${c.id}/evaluation`);await expect(page).toHaveURL(/\/ground-truth$/);await expect(page.getByLabel('Ground Truth Field 02')).toHaveValue('บริษัท ซีดีจี จำกัด\nABD');await expect(page.getByRole('link',{name:/5\. Evaluation/})).toHaveCount(0);
});

test('global boxes move/resize/delete/add without losing other identities or zoom coordinates',async({page})=>{
 await upload(page);await draw(page,[100,200],[700,400]);
 const pending=page.waitForResponse(r=>r.url().endsWith('/global-fields')&&r.request().method()==='PUT');await page.getByRole('button',{name:'บันทึก Layout ฉบับร่าง',exact:true}).click();const firstSaved=await(await pending).json();const firstROI=firstSaved.global_fields[0].roi;
 for(const [key,target] of Object.entries({x1:100,y1:200,x2:700,y2:400}))expect(Math.abs(firstROI[key as keyof typeof firstROI]-target)).toBeLessThanOrEqual(3);
 await draw(page,[100,600],[700,800]);await expect(page.getByTestId('global-field-nav')).toHaveCount(2);
 const viewer=page.getByTestId('document-viewer'),canvas=viewer.locator('.konvajs-content');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!,scale=Math.min((b.width-64)/1000,(b.height-64)/1320,1),x=b.x+(b.width-1000*scale)/2,y=b.y+(b.height-1320*scale)/2;
 const coords=async()=>(await viewer.getByText(/^พื้นที่ที่เลือก \(ROI\) \(/).textContent())!.match(/\d+/g)!.slice(0,4).map(Number);
 const before=await coords();await page.mouse.move(x+400*scale,y+700*scale);await page.mouse.down();await page.mouse.move(x+450*scale,y+750*scale,{steps:10});await page.mouse.up();const moved=await coords();expect(moved).not.toEqual(before);
 await page.mouse.move(x+moved[2]*scale,y+moved[3]*scale);await page.mouse.down();await page.mouse.move(x+(moved[2]+40)*scale,y+(moved[3]+30)*scale,{steps:10});await page.mouse.up();const resized=await coords();expect(resized[2]-resized[0]).toBeGreaterThan(moved[2]-moved[0]);
 await expect(page.getByTestId('global-field-nav')).toHaveCount(2);await page.getByRole('button',{name:'ลบ Field ที่เลือก',exact:true}).click();await expect(page.getByTestId('global-field-nav')).toHaveCount(1);await draw(page,[80,800],[800,1000]);const c=await confirm(page);expect(c.global_fields).toHaveLength(2);expect(c.global_fields![0].roi).toEqual(firstROI);
});

test('four-page PDF navigation preserves saved layout per selected page',async({page})=>{
 const doc=await upload(page,true);await detect(page);const first=await confirm(page);
 await page.getByRole('link',{name:/1\. Upload/}).click();await page.getByLabel('เลือกหน้า PDF').selectOption('2');
 await page.getByRole('button',{name:'ถัดไป: จัดการ Layout',exact:true}).click();await expect(page.getByTestId('global-field-nav')).toHaveCount(0);
 await detect(page);const second=await confirm(page);expect(second.id).not.toBe(first.id);expect(second.document.id).toBe(doc.id);expect(second.page_number).toBe(2);await run(page);
 await page.goto(`/workflow/${first.id}/pipelines`);await expect(page.getByTestId('global-field-nav')).toHaveCount(3);await expect(page.getByRole('button',{name:'Run OCR',exact:true})).toBeEnabled();
});

test('image upload refresh, bulk layout selection and safe back navigation preserve historical runs',async({page,request})=>{
 const doc=await upload(page);await detect(page);

 await page.getByLabel('เลือก Field 01',{exact:true}).check();await page.getByLabel('เลือก Field 03',{exact:true}).check();
 await page.getByRole('button',{name:'ลบ Fields ที่เลือก (2)',exact:true}).click();await expect(page.getByTestId('global-field-nav')).toHaveCount(1);
 const c=await confirm(page);await page.reload();await expect(page.getByTestId('global-field-nav')).toHaveCount(1);
 await page.getByRole('link',{name:/1\. Upload/}).click();await expect(page.getByAltText('เอกสารที่อัปโหลด')).toBeVisible();
 await page.reload();await expect(page.getByAltText('เอกสารที่อัปโหลด')).toBeVisible();await expect(page.getByTestId('workflow-upload').getByRole('alert')).toHaveCount(0);await expect(page).toHaveURL(new RegExp(`document=${doc.id}$`));
 await page.goto(`/workflow/${c.id}/layout`);await page.getByRole('button',{name:'กลับไปแก้ไข Layout',exact:true}).click();
 await expect(page.getByRole('button',{name:'เพิ่มกรอบ Manual',exact:true})).toBeVisible();await confirm(page);
 // A subset selection must really produce a single run, rather than always all configured pipelines.
 for(const label of ['Hutch Crop','Hutch Full','Benchmark','Thai FT v2','Hutch fine tune v2'])await page.getByRole('checkbox',{name:`เลือก ${label}`,exact:true}).uncheck();
 await page.getByRole('button',{name:'Run OCR',exact:true}).click();await expect(page).toHaveURL(/\/ground-truth$/);
 const historical=await(await request.get(`${api}/api/test-cases/${c.id}`)).json();expect(historical.runs.map((r:PipelineRun)=>r.pipeline_id)).toEqual(['mint']);
 await page.getByRole('link',{name:/2\. Global Layout/}).click();await page.getByRole('button',{name:'สร้างชุดทดสอบใหม่เพื่อแก้ Layout',exact:true}).click();
 await expect(page).not.toHaveURL(new RegExp(`/workflow/${c.id}/layout$`));await expect(page.getByRole('button',{name:'เพิ่มกรอบ Manual',exact:true})).toBeVisible();
 const preserved=await(await request.get(`${api}/api/test-cases/${c.id}`)).json();expect(preserved.global_fields).toEqual(historical.global_fields);expect(preserved.runs).toEqual(historical.runs);
});

for(const width of [390,768,1440])test(`global workflow responsive ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await upload(page);await detect(page);await confirm(page);await run(page);
 await page.getByLabel('Ground Truth Field 01').fill('บริษัท ซีดีจี จำกัด\nABXD');await page.getByRole('button',{name:'ยืนยันเพื่อคำนวณ',exact:true}).click();await expect(page).toHaveURL(/\/ground-truth$/);await expect(page.getByTestId('global-result-mint')).toBeVisible();
 await expect(page.getByTestId('global-result-mint').getByTestId('global-evaluation')).toBeVisible();expect((await page.getByTestId('document-viewer').locator('.konvajs-content').boundingBox())!.height).toBeLessThanOrEqual(520);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`test-results/global-${width}.png`,fullPage:true});
});
