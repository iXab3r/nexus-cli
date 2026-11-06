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

for (const scenario of ['stream-error', 'compressed', 'compressed-cap', 'race', 'symlink']) test(`S15 boundary ${scenario}`, async t => {
 const dir = await mkdtemp(join(await realpath(tmpdir()), 'nexus-boundary-'));
 t.after(() => rm(dir, {recursive:true, force:true}));
 const destination = join(dir, 'widget.jar');
 const {writeFile, symlink, readdir} = await import('node:fs/promises');
 if (scenario === 'symlink') { await writeFile(join(dir,'original'), 'preserve'); await symlink(join(dir,'original'), destination); }
 const {fixture:f, app:a} = await offlineCli(t,
 http.get('https://nexus.example.test/service/rest/v1/assets/id', () => HttpResponse.json({path:'widget.jar',downloadUrl:'https://nexus.example.test/file'})),
 http.get('https://nexus.example.test/file', async () => {
  if (scenario === 'race') await writeFile(destination, 'competitor', {flag:'wx'});
  if (scenario === 'stream-error') return new HttpResponse(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('partial'));controller.error(new Error('synthetic stream failure'));}}));
  const {gzipSync} = await import('node:zlib');
  const compressed = gzipSync('decoded payload');
  return new HttpResponse(compressed, {headers:{'content-encoding':'gzip','content-length':String(compressed.length)}});
 }));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const r = await f.run(a,['assets','download','id','--profile','lab','--json',...(scenario==='compressed-cap'?['--max-bytes','3']:[])],{cwd:dir});
 assert.equal(r.exitCode, scenario==='compressed'?0:1, r.stderr);
 if (scenario==='compressed') assert.equal(await readFile(destination,'utf8'),'decoded payload');
 else {
  assert.equal(JSON.parse(r.stdout).published,false);
  if(scenario==='race') assert.equal(await readFile(destination,'utf8'),'competitor');
  else if(scenario==='symlink') assert.equal(await readFile(destination,'utf8'),'preserve');
  else await assert.rejects(readFile(destination));
 }
 assert.deepEqual((await readdir(dir)).filter(name=>name.startsWith('.')),[]);
});

for(const phase of ['before','during','streaming']) test(`S15 cancellation ${phase} acquisition`,async t=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'nexus-abort-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const controller=new AbortController();let hits=0;
 const {fixture:f,app:a}=await offlineCli(t,
 http.get('https://nexus.example.test/service/rest/v1/assets/id',()=>HttpResponse.json({path:'widget.jar',downloadUrl:'https://nexus.example.test/file'})),
 http.get('https://nexus.example.test/file',()=>{hits++;if(phase==='streaming')return new HttpResponse(new ReadableStream({start(stream){stream.enqueue(new TextEncoder().encode('partial'));setTimeout(()=>{controller.abort();stream.error(new Error('synthetic cancellation'));},20);}}));controller.abort();return new HttpResponse('partial');}));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 if(phase==='before')controller.abort();
 const r=await f.run(a,['assets','download','id','--profile','lab','--json'],{cwd:dir,signal:controller.signal});
 assert.notEqual(r.exitCode,0);assert.equal(hits,phase==='before'?0:1);
 const {readdir}=await import('node:fs/promises');assert.deepEqual(await readdir(dir),[]);
 assert.doesNotMatch(r.stdout,/"published":true/);
});

for(const port of ['',':8081'])test(`S16 redirected upgrade credentials ${port||'default'}`,async t=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'nexus-upgrade-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const origin='http://nexus.example.test'+port;let hits=0;
 const {fixture:f,app:a}=await offlineCli(t,
 http.get(origin+'/service/rest/v1/search/assets/download',({request})=>{assert.equal(request.headers.get('authorization'),'Basic dXNlcjpwYXNz');assert.equal(new URL(request.url).searchParams.get('maven.classifier'),'');return new HttpResponse(null,{status:302,headers:{location:'https://nexus.example.test:9443/widget.jar'}});}),
 http.get('https://nexus.example.test:9443/widget.jar',({request})=>{hits++;assert.equal(request.headers.get('authorization'),'Basic dXNlcjpwYXNz');return new HttpResponse('hello');}));
 await f.run(a,['profile','configure','lab','--url',origin,'--credentials-stdin'],{input:Readable.from([JSON.stringify({username:'user',password:'pass'})])});
 const r=await f.run(a,['search','download','--name','widget','--maven-classifier','','--profile','lab','--json'],{cwd:dir});assert.equal(r.exitCode,0,r.stderr);assert.equal(hits,1);assert.equal(await readFile(join(dir,'widget.jar'),'utf8'),'hello');
});

for(const fault of ['publication','cleanup'])for(const mode of ['json','rpc'])test(`S15 ${fault} fault through ${mode}`,async t=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'nexus-fault-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const {fixture:f,app:a}=await offlineCli(t,
 http.get('https://nexus.example.test/service/rest/v1/assets/id',()=>HttpResponse.json({path:'widget.jar',downloadUrl:'https://nexus.example.test/file'})),
 http.get('https://nexus.example.test/file',()=>new HttpResponse('hello')));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const fs=(await import('node:fs')).default;const {syncBuiltinESMExports}=await import('node:module');
 const original=fs.promises.unlink;
 if(fault==='publication')t.mock.method(fs.promises,'link',async()=>{throw Object.assign(new Error('synthetic disk fault'),{code:'ENOSPC'});});
 else t.mock.method(fs.promises,'unlink',async(...args:Parameters<typeof original>)=>{if(String(args[0]).includes('.download-'))throw new Error('synthetic cleanup fault');return original(...args);});
 syncBuiltinESMExports();
 try {
 const args=['assets','download','id','--profile','lab'];let disposition;
 if(mode==='json'){const r=await f.run(a,[...args,'--json'],{cwd:dir});assert.equal(r.exitCode,1);disposition=JSON.parse(r.stdout);assert.equal(JSON.parse(r.stderr).error.code,'nexus.downloadFailed');}
 else {const replies=await f.rpc(a,[args],{cwd:dir}) as any[];assert.equal(replies[0].error.data.code,'nexus.downloadFailed');disposition=replies[0].error.data.result;}
 assert.deepEqual(disposition,{published:fault==='cleanup',cleanupFailed:fault==='cleanup'});
 if(fault==='cleanup')assert.equal(await readFile(join(dir,'widget.jar'),'utf8'),'hello');else await assert.rejects(readFile(join(dir,'widget.jar')));
 }finally{t.mock.restoreAll();syncBuiltinESMExports();}
});

for (const invalid of ['json', 'utf8', 'null', 'array', 'fields']) {
 for (const mode of ['json', 'rpc']) test(`asset metadata ${invalid} is safely rejected in ${mode}`, async t => {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'nexus-decode-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const marker = 'SYNTHETIC_RESPONSE_MARKER';
  let contentRequests = 0;
  const payload = invalid === 'json' ? marker : invalid === 'utf8' ? Uint8Array.of(0xff) : invalid === 'null' ? 'null' : invalid === 'array' ? '[]' : JSON.stringify({path: marker, downloadUrl: null});
  const {fixture: f, app: a} = await offlineCli(t,
   http.get('https://nexus.example.test/service/rest/v1/assets/id', () => new HttpResponse(payload)),
   http.get('https://nexus.example.test/content', () => {contentRequests++; return new HttpResponse('bytes');}));
  await f.run(a, ['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
  const args = ['assets','download','id','--profile','lab','--output',join(dir,'artifact.bin')];
  let diagnostics: string;
  if (mode === 'json') {
   const result = await f.run(a, [...args,'--json'], {cwd: dir});
   assert.equal(result.exitCode, 1);
   assert.equal(result.stdout, '');
   diagnostics = result.stderr;
  } else {
   const replies = await f.rpc(a, [args], {cwd: dir}) as any[];
   assert.ok(replies[0].error);
   diagnostics = JSON.stringify(replies);
  }
  assert.match(diagnostics, /nexus.decodeFailed/);
  assert.doesNotMatch(diagnostics, /SYNTHETIC_RESPONSE|SYNTHETIC_RE/);
  assert.equal(contentRequests, 0);
  const {readdir} = await import('node:fs/promises');
  assert.deepEqual(await readdir(dir), []);
 });
}
