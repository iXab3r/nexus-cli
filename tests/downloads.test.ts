import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { offlineCli } from './offline.js';
for (const kind of ['assets', 'search']) for (const status of [200, 206, 400, 404]) {
 test(`${kind} download status ${status} publishes only complete success`, async t => {
 const dir = await mkdtemp(join(tmpdir(), 'nexus-download-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 const {fixture:f, app:a}=await offlineCli(t,
 http.get('https://nexus.example.test/service/rest/v1/assets/id',()=>HttpResponse.json({path:'widget.jar',downloadUrl:'https://nexus.example.test/content/widget.jar'})),
 http.get('https://nexus.example.test/service/rest/v1/search/assets/download',()=>new HttpResponse(null,{status:302,headers:{location:'/content/widget.jar'}})),
 http.get('https://nexus.example.test/content/widget.jar',()=>new HttpResponse('hello',{status})));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const args=[kind,'download',...(kind==='assets'?['id']:['--name','widget']),'--output',join(dir,'widget.jar'),'--profile','lab'];
 const result=await f.run(a,args);
 assert.equal(result.exitCode,status===200?0:1);
 if(status===200) {assert.equal(await readFile(join(dir,'widget.jar'),'utf8'),'hello'); assert.equal((await f.run(a,args)).exitCode,1);}
 else await assert.rejects(readFile(join(dir,'widget.jar')));
 });
}
