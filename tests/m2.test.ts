import assert from 'node:assert/strict';
import test from 'node:test';
import { http, HttpResponse } from 'msw';
import { offlineCli } from './offline.js';
const base='https://nexus.example.test/service/rest/v1/';
for (const [story,argv,path,detail] of [
 ['S08',['components','list','--repository','releases'],'components',false],
 ['S09',['components','get','a/b'],'components/a%2Fb',true],
 ['S10',['assets','list','--repository','releases'],'assets',false],
 ['S11',['assets','get','a/b'],'assets/a%2Fb',true],
 ['S12',['search','components','--name','widget'],'search',false],
 ['S13',['search','assets','--maven-classifier',''],'search/assets',false],
] as const) test(`${story} real command returns metadata`,async t=>{
 const {fixture:f,app:a}=await offlineCli(t,http.get(base+path,({request})=>{
 if(story==='S13') assert.equal(new URL(request.url).searchParams.get('maven.classifier'),'');
 return HttpResponse.json(detail?{id:'a/b',path:'widget'}:{items:[{id:'a/b',path:'widget'}],continuationToken:null});
 }));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const r:any=await f.json(a,[...argv,'--profile','lab']);
 assert.equal(detail?r.id:r.items[0].id,'a/b');
});
test('S14 rejects page two whole and resumes its input token',async t=>{
 const {fixture:f,app:a}=await offlineCli(t,http.get(base+'assets',({request})=>new URL(request.url).searchParams.has('continuationToken')?new HttpResponse(null,{status:403}):HttpResponse.json({items:[{id:'one'}],continuationToken:'opaque+/='})));
 await f.run(a,['profile','configure','lab','--url','https://nexus.example.test','--auth-mode','anonymous']);
 const r=await f.run(a,['assets','list','--repository','releases','--all','--profile','lab','--json']);
 assert.equal(r.exitCode,1); const d=JSON.parse(r.stdout); assert.equal(d.items.length,1); assert.deepEqual(d.resume,{restart:false,token:'opaque+/='});
});
