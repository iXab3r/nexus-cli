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
