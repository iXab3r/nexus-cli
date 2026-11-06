import assert from 'node:assert/strict';
import test from 'node:test';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {http, HttpResponse} from 'msw';
import {offlineCli} from './offline.js';
const base='https://nexus.example.test/service/rest/v1/';
for(const upload of [false,true]) for(const status of [400,401,403]) test(`S27 ${upload?'upload':'read'} ${status}`,async t=>{
 let calls=0;
 const {fixture:f,app:a}=await offlineCli(t,http.all(base+'*',()=>{calls++;return new HttpResponse('SYNTHETIC_BODY_MARKER\u001b[31m',{status});}));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const file=join(f.root,'artifact.txt'); await writeFile(file,'synthetic');
 const argv=upload?['components','upload','raw','--repository','releases','--file',file,'--directory','/']:['repositories','get','releases'];
 if(upload){const denied=await f.run(a,[...argv,'--profile','lab','--json']);assert.equal(calls,0);assert.match(denied.stderr,/permissions.*grant.*Update/);}
 await f.run(a,['permissions','grant','Update','--profile','lab']);
 for(const flags of [[],['--verbose'],['--json'],['--json','--verbose']]){
 const r=await f.run(a,[...argv,'--profile','lab',...flags]); assert.equal(r.exitCode,1);assert.equal(r.stdout,'');
 assert.match(r.stderr,/releases/); assert.match(r.stderr,upload?/upload/i:/read/i);
 assert.match(r.stderr,status===401?/authentication.*rejected/i:status===403?/denied/i:upload?/raw\.directory/:/parameters/i);
 assert.doesNotMatch(r.stderr,/SYNTHETIC_BODY_MARKER|\u001b\[31m/);
 if(status===403)assert.doesNotMatch(r.stderr,/password|replace.*credential/i);
 }
 const rpc=JSON.stringify(await f.rpc(a,[[...argv,'--profile','lab','--verbose']]));assert.match(rpc,/releases/);assert.doesNotMatch(rpc,/SYNTHETIC_BODY_MARKER/);
});
for(const repository of ['bad\u001b[31mSYNTHETIC_LABEL', 'https://example.test/private?marker=SYNTHETIC_LABEL', 'x'.repeat(1000)]) test('S27 unsafe repository labels stay out of diagnostics',async t=>{
 const {fixture:f,app:a}=await offlineCli(t,http.get(base+'repositories/*',()=>new HttpResponse('SYNTHETIC_BODY_MARKER',{status:403})));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const argv=['repositories','get',repository,'--profile','lab'];
 for(const flags of [[],['--verbose'],['--json'],['--json','--verbose']]){
 const r=await f.run(a,[...argv,...flags]);assert.equal(r.exitCode,1);assert.match(r.stderr,/selected repository/);assert.doesNotMatch(r.stderr,/SYNTHETIC_LABEL|SYNTHETIC_BODY_MARKER|x{100}/);
 }
 assert.doesNotMatch(JSON.stringify(await f.rpc(a,[[...argv,'--verbose']])),/SYNTHETIC_LABEL|SYNTHETIC_BODY_MARKER|x{100}/);
});

// Exercise the native transport boundary: an HTTP status mock does not cover nested causes.
for (const operation of ['read', 'upload', 'download']) test(`S27 nested ${operation} diagnostics redact request resources`, async t => {
 const {createCli} = await import('@eyeauras/cli-factory');
 const {createCliFixture} = await import('@eyeauras/cli-factory/testing');
 const {createDefinition} = await import('../src/cli.js');
 const password = 'SYNTHETIC_CONFIGURED_PASSWORD';
 const repository = 'https://example.test/PRIVATE_REPO_MARKER?x=QUERY_MARKER';
 const f = await createCliFixture(t, {applicationId:'nexus-cli', profiles:[{name:'lab',values:{url:'https://nexus.example.test',authMode:'basic'},secrets:{credentials:JSON.stringify({username:'synthetic-user',password})}}]});
 const a = f.createApplication(runtime => createCli({...createDefinition(),runtime:{...runtime,fetch:async input => {
  const url = String(input);
  const native = Object.assign(new Error(`socket failed ${url} ${repository} ${password}`),{code:'ECONNRESET'});
  throw new Error('transport unavailable',{cause:native});
 }}}));
 const file = join(f.root,'synthetic.txt'); await writeFile(file,'synthetic');
 await f.run(a,['permissions','grant','Update','--profile','lab']);
 const argv = operation==='read' ? ['repositories','get',repository]
  : operation==='upload' ? ['components','upload','raw','--repository',repository,'--file',file,'--directory','/']
  : ['content','download','--repository',repository,'--path','artifact.txt'];
 for (const flags of [[],['--verbose'],['--json'],['--json','--verbose']]) {
  const r = await f.run(a,[...argv,'--profile','lab',...flags]);
  assert.equal(r.exitCode,1); if(operation!=='download') assert.equal(r.stdout,'');
  assert.doesNotMatch(r.stderr,/PRIVATE_REPO_MARKER|QUERY_MARKER|SYNTHETIC_CONFIGURED_PASSWORD/);
  assert.match(r.stderr,/socket failed/);
  if(flags.includes('--json') || flags.includes('--verbose')) assert.match(r.stderr,/ECONNRESET/);
  if(flags.includes('--verbose')) assert.match(r.stderr,/diagnostics\.test\.js/);
 }
 const rpc = JSON.stringify(await f.rpc(a,[[...argv,'--profile','lab','--verbose']]));
 assert.doesNotMatch(rpc,/PRIVATE_REPO_MARKER|QUERY_MARKER|SYNTHETIC_CONFIGURED_PASSWORD/);
 assert.match(rpc,/ECONNRESET/); assert.match(rpc,/diagnostics\.test\.js/);
});
