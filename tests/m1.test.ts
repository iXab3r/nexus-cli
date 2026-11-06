import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { http, HttpResponse } from 'msw';
import { offlineCli } from './offline.js';
const url = 'https://nexus.example.test:443/context';
const pair = JSON.stringify({username:'synthetic-reader',password:'synthetic-password'});
async function configure(f:any,a:any,name='lab', anonymous=false) {
 return f.run(a,['profile','configure',name,'--url',url,...(anonymous?['--auth-mode','anonymous']:['--credentials-stdin']),'--json'],{input:Readable.from([pair])});
}
test('S01 validates and stores a pair; S03 status separates access from identity and logout is local',async t=>{
 const {fixture:f,app:a}=await offlineCli(t,http.get('https://nexus.example.test/context/service/rest/v1/repositories',()=>HttpResponse.json([])));
 assert.equal((await configure(f,a)).exitCode,0);
 const profile:any=await f.json(a,['profile','show','lab']);
 assert.ok(JSON.stringify(profile).includes(':443/context')); assert.ok(!JSON.stringify(profile).includes('synthetic-password'));
 const status:any=await f.json(a,['auth','status','--profile','lab']);
 assert.equal(status.identity.state,'storedUnverified'); assert.equal(status.identity.probe,'accessObserved');
 assert.equal((await f.run(a,['auth','logout','--profile','lab'])).exitCode,0);
 const absent:any=await f.json(a,['auth','status','--profile','lab']); assert.equal(absent.identity.state,'absent');
});
test('S01 malformed and missing credentials fail before service calls',async t=>{
 const {fixture:f,app:a}=await offlineCli(t);
 for(const input of ['bad',JSON.stringify({username:'bad:name',password:'x'})]) {
 const r=await f.run(a,['profile','configure','lab','--url',url,'--credentials-stdin','--json'],{input:Readable.from([input])}); assert.notEqual(r.exitCode,0);
 }
 assert.notEqual((await f.run(a,['profile','configure','lab','--url',url,'--json'])).exitCode,0);
});
test('S04 anonymous, S06 empty/list output, S07 encoded name and missing resource',async t=>{
 const {fixture:f,app:a}=await offlineCli(t,http.get('https://nexus.example.test/context/service/rest/v1/repositories',({request})=>{assert.equal(request.headers.get('authorization'),null);return HttpResponse.json([]);}),http.get('https://nexus.example.test/context/service/rest/v1/repositories/:name',({params})=>params.name==='a/b'?HttpResponse.json({name:'a/b',format:'raw',type:'hosted',url:'https://nexus.example.test/repository/a',online:true}):new HttpResponse(null,{status:404})));
 assert.equal((await configure(f,a,'public',true)).exitCode,0);
 assert.deepEqual(await f.json(a,['repositories','list','--profile','public']),[]);
 assert.match((await f.run(a,['repositories','list','--profile','public'])).stdout,/No visible repositories/);
 const result:any=await f.json(a,['repositories','get','a/b','--profile','public']);assert.equal(result.name,'a/b');
 assert.equal((await f.run(a,['repositories','get','missing','--profile','public'])).exitCode,1);
});
test('S02 missing profile and S05 source status endpoints',async t=>{
 const {fixture:f,app:a}=await offlineCli(t,http.get('https://nexus.example.test/context/service/rest/v1/status',()=>new HttpResponse(null,{status:200})),http.get('https://nexus.example.test/context/service/rest/v1/status/writable',()=>new HttpResponse(null,{status:200})));
 assert.notEqual((await f.run(a,['repositories','list','--profile','missing'])).exitCode,0);
 assert.equal((await configure(f,a,'public',true)).exitCode,0);
 assert.deepEqual(await f.json(a,['status','--profile','public']),{readable:true,writable:true});
});
