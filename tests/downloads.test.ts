import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { offlineCli } from './offline.js';
for (const kind of ['assets', 'search']) for (const status of [200, 206, 400, 404]) {
 test(`${kind} download status ${status} publishes only complete success`, async t => {
 const dir = await mkdtemp(join(await realpath(tmpdir()), 'nexus-download-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 const {fixture:f, app:a}=await offlineCli(t,
 http.get('https://nexus.example.test/service/rest/v1/assets/id',()=>HttpResponse.json({path:'widget.jar',downloadUrl:'https://nexus.example.test/content/widget.jar'})),
 http.get('https://nexus.example.test/service/rest/v1/search/assets/download',()=>new HttpResponse(null,{status:302,headers:{location:'/content/widget.jar'}})),
 http.get('https://nexus.example.test/content/widget.jar',()=>new HttpResponse('hello',{status})));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const args=[kind,'download',...(kind==='assets'?['id']:['--name','widget']),'--output',join(dir,'widget.jar'),'--profile','lab'];
 const result=await f.run(a,args);
 assert.equal(result.exitCode,status===200?0:1,result.stderr);
 if(status===200) {assert.equal(await readFile(join(dir,'widget.jar'),'utf8'),'hello'); assert.equal((await f.run(a,args)).exitCode,1);}
 else await assert.rejects(readFile(join(dir,'widget.jar')));
 });
}
for(const scenario of ['default','checksum','mismatch','cap','length','unsafe','cross-origin','rpc']) test(`S15 ${scenario}`,async t=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'nexus-download-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const target=scenario==='unsafe'?'http://other.example.test/file':scenario==='cross-origin'?'https://other.example.test/file':'https://nexus.example.test/file';
 let contentRequests=0;
 const {fixture:f,app:a}=await offlineCli(t,
 http.get('https://nexus.example.test/service/rest/v1/assets/id',()=>HttpResponse.json({path:'widget.jar',downloadUrl:target})),
 http.get(target,({request})=>{contentRequests++; assert.equal(request.headers.get('authorization'),null);return new HttpResponse('hello',{headers:scenario==='length'?{'content-length':'100'}:{}});}));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const hash='2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
 const args=['assets','download','id','--profile','lab',...(scenario==='checksum'?['--sha256',hash]:scenario==='mismatch'?['--sha256','0'.repeat(64)]:scenario==='cap'?['--max-bytes','2']:[])];
 if(scenario==='rpc'){const result=await f.rpc(a,[args],{cwd:dir});assert.match(JSON.stringify(result),/widget.jar/);}
 else {const r=await f.run(a,[...args,'--json'],{cwd:dir});const fails=['mismatch','cap','length','unsafe'].includes(scenario); assert.equal(r.exitCode,fails?1:0,r.stderr); if(fails){await assert.rejects(readFile(join(dir,'widget.jar')));assert.equal(JSON.parse(r.stdout).published,false);}else {assert.equal(await readFile(join(dir,'widget.jar'),'utf8'),'hello');assert.equal(JSON.parse(r.stdout).verified,scenario==='checksum');}}
 if(scenario==='unsafe')assert.equal(contentRequests,0);
});
for(const mode of ['upgrade','external','return','downgrade','loop'])test(`S15 redirect credential safety ${mode}`,async t=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'nexus-download-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const origin=mode==='upgrade'?'http://nexus.example.test:8081':'https://nexus.example.test';
 const first=mode==='upgrade'?'https://nexus.example.test:9443/file':mode==='external'?'https://other.example.test/file':origin+'/file';
 let hits=0;
 const {fixture:f,app:a}=await offlineCli(t,
 http.get(origin+'/service/rest/v1/assets/id',()=>HttpResponse.json({path:'widget.jar',downloadUrl:first})),
 http.get(first,({request})=>{hits++;assert.equal(request.headers.get('authorization'),mode==='external'?null:'Basic dXNlcjpwYXNz');if(mode==='return')return new HttpResponse(null,{status:302,headers:{location:'https://other.example.test/hop'}});if(mode==='downgrade')return new HttpResponse(null,{status:302,headers:{location:'http://nexus.example.test/end'}});if(mode==='loop')return new HttpResponse(null,{status:302,headers:{location:first}});return new HttpResponse('hello');}),
 http.get('https://other.example.test/hop',({request})=>{assert.equal(request.headers.get('authorization'),null);return new HttpResponse(null,{status:302,headers:{location:origin+'/end'}});}),
 http.get(origin+'/end',({request})=>{assert.equal(request.headers.get('authorization'),null);return new HttpResponse('hello');}));
 await f.run(a,['profile','configure','lab','--url',origin,'--credentials-stdin'],{input:Readable.from([JSON.stringify({username:'user',password:'pass'})])});
 const r=await f.run(a,['assets','download','id','--profile','lab'],{cwd:dir});
 assert.equal(r.exitCode,['downgrade','loop'].includes(mode)?1:0,r.stderr);assert.ok(hits>0);
});
