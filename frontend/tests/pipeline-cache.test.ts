import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {configuration,invalidateConfiguration} from '../lib/pipeline-cache';
import {localDB} from '../lib/local-db/schema';
test('pipeline cache deduplicates, validates ETag and rejects stale inflight writes',async()=>{
 const original=globalThis.fetch;const base='https://synthetic.invalid';let count=0;
 try{
 await invalidateConfiguration();globalThis.fetch=async()=>{count++;return new Response(JSON.stringify([{name:'first'}]),{headers:{ETag:'"config-1"','X-Config-Revision':'1'}});};
 const reads=await Promise.all(Array.from({length:10},()=>configuration('/pipelines',base)));assert.equal(count,1);assert.deepEqual(reads[0],[{name:'first'}]);
 await localDB().config.update(`${base}/pipelines`,{checked_at:0});
 globalThis.fetch=async(_url,init)=>{count++;assert.equal((init?.headers as Record<string,string>)['If-None-Match'],'"config-1"');return new Response(null,{status:304});};
 assert.deepEqual(await configuration('/pipelines',base),[{name:'first'}]);assert.equal(count,2);
 await localDB().config.update(`${base}/pipelines`,{checked_at:0});let release!:(r:Response)=>void;
 globalThis.fetch=()=>new Promise(resolve=>{release=resolve;});const stale=configuration('/pipelines',base);
 while(!release)await new Promise(resolve=>setTimeout(resolve,1));await invalidateConfiguration();
 globalThis.fetch=async()=>new Response(JSON.stringify([{name:'updated'}]),{headers:{ETag:'"config-2"','X-Config-Revision':'2'}});
 release(new Response(JSON.stringify([{name:'old'}]),{headers:{ETag:'"config-1"','X-Config-Revision':'1'}}));
 assert.deepEqual(await stale,[{name:'updated'}]);assert.equal((await localDB().config.get(`${base}/pipelines`))?.revision,2);
 }finally{globalThis.fetch=original;await invalidateConfiguration();localDB().close();}
});
