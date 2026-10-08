import {test,expect} from '@playwright/test';
import path from 'node:path';
test('cross-origin local workflow, dataset, backup and isolation',async({page,browser,request})=>{
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
 await page.goto('/');await expect(page.getByTestId('workflow-upload')).toBeVisible();
 await page.locator('input[type=file]').setInputFiles(path.resolve('public/sample-document.png'));
 await expect(page.getByAltText('เอกสารที่อัปโหลด')).toBeVisible();
 await page.getByRole('button',{name:'ถัดไป: จัดการ Layout',exact:true}).click();
 await expect(page.getByTestId('document-viewer').locator('canvas').first()).toBeVisible();
 await page.getByRole('button',{name:'Auto Layout',exact:true}).click();
 await expect(page.getByTestId('global-field-nav')).toHaveCount(3);
 // Draw a fourth manual ROI on the same canonical image.
 const manual=page.getByRole('button').filter({hasText:/Manual/});await manual.click();const canvas=page.getByTestId('document-viewer').locator('.konvajs-content');await canvas.scrollIntoViewIfNeeded();const box=(await canvas.boundingBox())!;
 const scale=Math.min((box.width-64)/1000,(box.height-64)/1320,1),x=box.x+(box.width-1000*scale)/2,y=box.y+(box.height-1320*scale)/2;
 await page.mouse.move(x+80*scale,y+800*scale);await page.mouse.down();await page.mouse.move(x+850*scale,y+930*scale,{steps:12});await page.mouse.up();await expect(page.getByTestId('global-field-nav')).toHaveCount(4);
 await page.getByRole('button',{name:'ยืนยัน ROI',exact:true}).click();
 await expect(page).toHaveURL(/\/pipelines$/);
 await page.getByRole('button',{name:'Run OCR',exact:true}).click();
 await expect(page).toHaveURL(/\/ground-truth$/);
 for(const n of [1,2,3,4])await page.getByLabel(`Ground Truth Field ${String(n).padStart(2,'0')}`,{exact:true}).fill('บริษัท ซีดีจี จำกัด');
 await page.getByRole('button',{name:'ยืนยันเพื่อคำนวณ',exact:true}).click();
 await expect(page.getByTestId('global-evaluation').first()).toBeVisible();
 const route=new URL(page.url()).pathname;await page.reload();await expect(page.getByTestId('global-evaluation').first()).toBeVisible();
 await page.goto('/history');await expect(page.getByText('sample-document.png').first()).toBeVisible();
 const metrics=async()=>{const r=await request.get('http://127.0.0.1:8100/api/admin/metrics',{headers:{Authorization:'Bearer synthetic-admin'}});expect(r.status()).toBe(200);return r.json();};
 const before=await metrics();for(let i=0;i<100;i++)await page.goto('/history');await expect(page.getByText('sample-document.png').first()).toBeVisible();const after=await metrics();expect(after.queries-before.queries).toBe(0);
 await page.goto('/matrix');await expect(page.getByText('sample-document.png').first()).toBeVisible();
 await page.goto('/dataset');await expect(page.getByText('sample-document.png').first()).toBeVisible();
 await page.getByRole('checkbox',{name:'เลือกตัวอย่างในหน้านี้ทั้งหมด'}).check();
 const zip=page.waitForEvent('download');await page.getByRole('button',{name:/ส่งออก ZIP/}).click();expect((await zip).suggestedFilename()).toMatch(/\.zip$/);
 await page.goto('/settings/local');const download=page.waitForEvent('download');await page.getByRole('button',{name:'ส่งออกข้อมูลสำรอง',exact:true}).click();const backup=await download;const filename=await backup.path();expect(filename).toBeTruthy();
 await page.locator('input[type=file]').setInputFiles(filename!);await page.getByLabel('เมื่อข้อมูลซ้ำ').selectOption('replace');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'กู้คืนข้อมูล',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('กู้คืนเอกสาร');
 const clean=await browser.newContext();const other=await clean.newPage();await other.goto('/history');await expect(other.getByText('sample-document.png')).toHaveCount(0);await other.goto('/settings/pipelines');await expect(other.getByText('Synthetic custom',{exact:true}).first()).toBeVisible();await clean.close();
 await page.goto(route);await expect(page.getByTestId('global-evaluation').first()).toBeVisible();expect(failures).toEqual([]);
});
test('PDF preparation persists selected page across refresh',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(path.resolve('tests/fixtures/two-pages.pdf'));
 const pages=page.getByLabel('เลือกหน้า PDF');await expect(pages).toBeVisible();await expect(pages.locator('option')).toHaveCount(2);await pages.selectOption('2');await expect(page).toHaveURL(/page=2/);await page.reload();await expect(pages).toHaveValue('2');await expect(page.getByAltText('เอกสารที่อัปโหลด')).toBeVisible();
});
