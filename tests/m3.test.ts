import assert from 'node:assert/strict';
import test from 'node:test';
import { http, HttpResponse } from 'msw';
import { offlineCli } from './offline.js';
const base = 'https://nexus.example.test/service/rest/v1/';
for (const kind of ['assets', 'components']) for (const scenario of ['success','confirm','gate','preflight','denied','unknown']) test(`${kind} delete ${scenario}`, async t => {
 let gets=0, deletes=0;
 const {fixture:f,app:a}=await offlineCli(t,http.get(base+kind+'/a%2Fb',()=>{gets++; return scenario==='preflight'?new HttpResponse(null,{status:404}):HttpResponse.json({id:'a/b',assets:[{id:'one'}]});}),http.delete(base+kind+'/a%2Fb',()=>{deletes++; return scenario==='unknown'?HttpResponse.error():new HttpResponse(null,{status:scenario==='denied'?403:204});}));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 if(scenario!=='gate') await f.run(a,['permissions','grant','Update','--profile','lab']);
 const r=await f.run(a,[kind,'delete','a/b','--confirm-id',scenario==='confirm'?'wrong':'a/b','--profile','lab','--json']);
 assert.equal(r.exitCode,scenario==='success'?0:scenario==='confirm'?2:1);
 assert.equal(gets,['confirm','gate'].includes(scenario)?0:1);
 assert.equal(deletes,['confirm','gate','preflight'].includes(scenario)?0:1);
 if(scenario==='success') assert.equal(JSON.parse(r.stdout).id,'a/b');
 if(scenario==='unknown') assert.match(r.stderr,/nexus.mutation.outcomeUnknown/);
});
test('S17 upload specification',async t=>{
 const {fixture:f,app:a}=await offlineCli(t,http.get(base+'formats/upload-specs/raw',()=>HttpResponse.json({format:'raw',multipleUpload:true,componentFields:[],assetFields:[]})));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 assert.equal((await f.json(a,['formats','upload-specs','get','raw','--profile','lab']) as any).format,'raw');
});
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
for(const format of ['raw','maven']) test(`${format} multipart upload`,async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexus-upload-')); t.after(()=>rm(dir,{recursive:true,force:true})); const file=join(dir,'widget.jar'); await writeFile(file,'synthetic jar');
 let form:FormData|undefined;
 const {fixture:f,app:a}=await offlineCli(t,http.post(base+'components',async ({request})=>{assert.equal(new URL(request.url).searchParams.get('repository'),'releases');form=await request.formData();return new HttpResponse(null,{status:204});}));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);await f.run(a,['permissions','grant','Update','--profile','lab']);
 const r=await f.run(a,['components','upload',format,'--repository','releases','--file',file,...(format==='raw'?['--directory','/']:['--group','com.example','--artifact','widget','--version','1.0','--extension','jar']),'--profile','lab','--json']);
 assert.equal(r.exitCode,0,r.stderr);assert.equal(JSON.parse(r.stdout).repository,'releases');
 const prefix=format==='raw'?'raw':'maven2'; assert.equal(await (form!.get(prefix+'.asset1') as File).text(),'synthetic jar');
 if(format==='raw') {assert.equal(form!.get('raw.directory'),'/');assert.equal(form!.get('raw.asset1.filename'),'widget.jar');} else {assert.equal(form!.get('maven2.generate-pom'),'true');assert.equal(form!.get('maven2.asset1.extension'),'jar');assert.equal(form!.get('maven2.groupId'),'com.example');assert.equal(form!.get('maven2.packaging'),'jar');assert.equal(form!.get('maven2.asset1.classifier'),null);}
});
