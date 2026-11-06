import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";
const base = "https://nexus.example.test/service/rest/v1/repositories/raw/hosted";
const settings = { name: "raw-releases", online: false, storage: { blobStoreName: "existing", strictContentTypeValidation: false, writePolicy: "ALLOW_ONCE" }, cleanup: { policyNames: [] }, component: { proprietaryComponents: false }, raw: { contentDisposition: "INLINE" } };
const create = ["repositories", "hosted", "raw", "create", "raw-releases", "--blob-store", "existing", "--write-policy", "ALLOW_ONCE", "--online", "false", "--strict-content-type-validation", "false", "--profile", "lab"];
for (const scenario of ["json", "human", "rpc", "401", "403", "404", "malformed"])
 test(`S22 ${scenario}`, async t => {
  let gets = 0;
  const { fixture:f, app:a } = await offlineCli(t, http.get(base + "/a%2Fb", () => { gets++; return HttpResponse.json(scenario === "malformed" ? {} : {...settings, proxy: {password: "synthetic-private-value"}, storage: {...settings.storage, password: "synthetic-private-value"}}, {status: /^\d+$/.test(scenario) ? Number(scenario) : 200}); }));
  await f.run(a, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const argv = ["repositories", "hosted", "raw", "get", "a/b", "--profile", "lab"];
  if (scenario === "rpc") { const r:any = await f.rpc(a, [argv]); assert.deepEqual(r[0].result, settings); }
  else { const r = await f.run(a, [...argv, ...(scenario === "human" ? [] : ["--json"])]); assert.equal(r.exitCode, ["json", "human"].includes(scenario) ? 0 : 1); if (scenario === "json") assert.deepEqual(JSON.parse(r.stdout), settings); if (scenario === "human") assert.match(r.stdout, /ALLOW_ONCE/); assert.doesNotMatch(r.stdout+r.stderr, /synthetic-private-value/); }
  assert.equal(gets,1);
 });
for (const scenario of ["json", "human", "rpc", "gate", "invalid", "missing", "400", "401", "403", "409", "200", "204", "unknown"])
 test(`S23 ${scenario}`, async t => {
  let posts = 0;
  const {fixture:f, app:a} = await offlineCli(t, http.post(base, async ({request}) => { posts++; assert.equal(request.headers.get("content-type"), "application/json"); assert.deepEqual(await request.json(), {name:"raw-releases",online:false,storage:settings.storage,component:{proprietaryComponents:false},raw:{contentDisposition:"ATTACHMENT"}}); return scenario === "unknown" ? HttpResponse.error() : new HttpResponse(null,{status:/^\d+$/.test(scenario)?Number(scenario):201}); }));
  await f.run(a,["profile","configure","lab","--url","https://nexus.example.test","--auth-mode","anonymous"]);
  if(scenario !== "gate") await f.run(a,["permissions","grant","Update","--profile","lab"]);
  const argv = [...create]; if(scenario === "invalid") argv[10] = "yes"; if(scenario === "missing") argv.splice(5,2);
  if(scenario === "rpc") {const r:any=await f.rpc(a,[argv]); assert.equal(r[0].result.acknowledged,true);}
  else { const r=await f.run(a,[...argv,...(scenario === "human"?[]:["--json"])]); assert.equal(r.exitCode,["json","human"].includes(scenario)?0:["invalid","missing"].includes(scenario)?2:1,r.stderr); if(scenario === "json") assert.deepEqual(JSON.parse(r.stdout),{name:"raw-releases",acknowledged:true}); if(scenario === "human") assert.match(r.stdout,/raw-releases/); if(scenario === "unknown") assert.match(r.stderr,/outcomeUnknown/); }
  assert.equal(posts,["gate","invalid","missing"].includes(scenario)?0:1);
 });
