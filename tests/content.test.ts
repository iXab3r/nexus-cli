import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { offlineCli } from './offline.js';
const digest='2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
for(const scenario of ['default','relative','absolute','checksum','mismatch','cap','missing-parent','existing','401','403','gate','rpc','rpc-failure']) test(`S26 ${scenario}`,async t=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'nexus-content-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 let hits=0;
 const {fixture:f,app:a}=await offlineCli(t,http.get('*',({request})=>{hits++;assert.equal(request.url,'https://nexus.example.test/context/repository/raw%2Fopaque/folder/a%20%E9%9B%AA.bin');return new HttpResponse('hello',{status:['401','403'].includes(scenario)?Number(scenario):200});}));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test/context/','--auth-mode','anonymous']);
 if(scenario==='gate')await f.run(a,['permissions','revoke','ReadOnly','--profile','lab']);
 const output=scenario==='relative'?'out.bin':scenario==='absolute'?join(dir,'out.bin'):scenario==='missing-parent'?'missing/out.bin':undefined;
 if(scenario==='existing')await writeFile(join(dir,'a 雪.bin'),'preserve');
 const args=['content','download','--repository','raw/opaque','--path','folder/a 雪.bin','--profile','lab',...(output?['--output',output]:[]),...(['checksum','mismatch','rpc-failure'].includes(scenario)?['--sha256',scenario==='checksum'?digest:'0'.repeat(64)]:[]),...(scenario==='cap'?['--max-bytes','2']:[])];
 if(scenario.startsWith('rpc')){const replies=await f.rpc(a,[args],{cwd:dir}) as any[];if(scenario==='rpc')assert.equal(replies[0].result.bytes,5);else assert.equal(replies[0].error.data.result.published,false);}
 else {const r=await f.run(a,[...args,'--json'],{cwd:dir});assert.equal(r.exitCode,['mismatch','cap','missing-parent','existing','401','403','gate'].includes(scenario)?1:0,r.stderr);if(r.exitCode===0){assert.equal(await readFile(JSON.parse(r.stdout).path,'utf8'),'hello');assert.equal(JSON.parse(r.stdout).verified,scenario==='checksum');}}
 if(scenario==='gate')assert.equal(hits,0);else assert.ok(hits<=1);
 if(scenario==='existing')assert.equal(await readFile(join(dir,'a 雪.bin'),'utf8'),'preserve');
});
for(const path of ['', '/', '../x','a/../x','a/./x','a//x','a/','https://other.example.test/x','a\\x','a\nx','a\u007fx','a/%2f','a/%252e','a/%25%32%65']) test(`S26 rejects ${JSON.stringify(path)}`,async t=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'nexus-content-'));t.after(()=>rm(dir,{recursive:true,force:true}));let hits=0;
 const {fixture:f,app:a}=await offlineCli(t,http.get('*',()=>{hits++;return new HttpResponse('bad');}));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const args=['content','download','--repository','raw','--path',path,'--profile','lab'];
 const r=await f.run(a,args,{cwd:dir});assert.equal(r.exitCode,2,r.stderr);
 const replies=await f.rpc(a,[args],{cwd:dir}) as any[];assert.equal(replies[0].error.data.exitCode,2);
 assert.equal(hits,0);assert.deepEqual(await readdir(dir),[]);
});
