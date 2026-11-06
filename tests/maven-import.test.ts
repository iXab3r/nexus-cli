import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";

const pom = Buffer.from('\ufeff<project>\r\n<parent><groupId>com.example</groupId><version>1</version></parent><artifactId>widget</artifactId><dependencies><dependency><artifactId>other</artifactId></dependency></dependencies></project>\r\n');
for (const scenario of ["human", "json", "rpc", "max", "gate", "400", "401", "403", "200", "unknown", "empty", "excess", "duplicate", "reserved", "unsafe", "invalid", "keys", "types", "blank", "conflict", "generation", "missing", "directory", "symlink"]) {
  test(`S25 original POM ${scenario}`, async t => {
    const root = await mkdtemp(join(tmpdir(), "nexus-pom-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const p = join(root, "widget.pom"), file = join(root, "widget.jar");
    await writeFile(p, pom); await writeFile(file, "synthetic companion");
    const link = join(root, "link"); await symlink(file, link);
    const requests: FormData[] = [];
    const { fixture: f, app: a } = await offlineCli(t, http.post("https://nexus.example.test/service/rest/v1/components", async ({ request }) => {
      assert.equal(new URL(request.url).search, "?repository=releases");
      requests.push(await request.formData());
      return scenario === "unknown" ? HttpResponse.error() : new HttpResponse(scenario === "400" ? "synthetic invalid POM detail" : null, { status: /^\d+$/.test(scenario) ? Number(scenario) : 204 });
    }));
    await f.run(a, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
    if (scenario !== "gate") await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"]);
    let assets: any[] = [{ file, extension: "jar" }];
    if (["json", "rpc"].includes(scenario)) assets.push({file, extension:"jar", classifier:"sources"}, {file, extension:"jar.asc"}, {file,extension:"pom.asc"});
    if (["max", "excess"].includes(scenario)) assets = Array.from({length:scenario === "max" ? 16 : 17}, (_,i)=>({file,extension:"jar",classifier:`c${i}`}));
    if (scenario === "empty") assets=[];
    if (scenario === "duplicate") assets.push({file,extension:"jar",classifier:""});
    if (scenario === "reserved") assets=[{file,extension:"pom",classifier:""}];
    if (scenario === "unsafe") assets=[{file,extension:"../jar"}];
    if (scenario === "keys") assets=[{file,extension:"jar",extra:true}];
    if (scenario === "types") assets=[{file,extension:1}];
    if (scenario === "blank") assets=[{file:"",extension:"jar"}];
    if (scenario === "missing") assets.push({file:join(root,"absent"),extension:"zip"});
    if (scenario === "directory") assets.push({file:root,extension:"zip"});
    if (scenario === "symlink") assets.push({file:link,extension:"zip"});
    const argv=["components","upload","maven","--repository","releases","--pom",p,...assets.flatMap(x=>["--asset",scenario === "invalid" ? "{" : JSON.stringify(x)]),"--profile","lab"];
    if(scenario === "conflict") argv.push("--group","com.example");
    if(scenario === "generation") argv.push("--generate-pom","true");
    const valid=["human","json","rpc","max","400","401","403","200","unknown"].includes(scenario);
    if(scenario === "rpc") {
      const result:any=await f.rpc(a,[argv]); assert.deepEqual(result[0].result,{repository:"releases",acknowledged:true});
    } else {
      const result=await f.run(a,[...argv,...(scenario === "human" ? [] : ["--json"])]);
      const success=["human","json","max"].includes(scenario);
      assert.equal(result.exitCode,success?0:valid||scenario === "gate"?1:2,result.stderr);
      if(success) assert.match(result.stdout,/releases/);
      else assert.equal(result.stdout,"");
      if(scenario === "unknown") assert.match(result.stderr,/outcomeUnknown/);
      assert.doesNotMatch(result.stdout+result.stderr,/synthetic invalid POM detail/);
    }
    assert.equal(requests.length,valid?1:0);
    if(valid) {
      const form=requests[0];
      assert.equal(form.get("maven2.generate-pom"),"false");
      for(const key of ["groupId","artifactId","version","packaging"]) assert.equal(form.get(`maven2.${key}`),null);
      assert.equal(form.get("maven2.asset1.extension"),"pom");
      assert.equal(form.get("maven2.asset1.classifier"),null);
      assert.deepEqual(Buffer.from(await (form.get("maven2.asset1") as File).arrayBuffer()),pom);
      for(let i=0;i<assets.length;i++) {
        assert.equal(form.get(`maven2.asset${i+2}.extension`),assets[i].extension);
        assert.equal(form.get(`maven2.asset${i+2}.classifier`),assets[i].classifier||null);
        assert.equal(await (form.get(`maven2.asset${i+2}`) as File).text(),"synthetic companion");
      }
      assert.equal(form.get(`maven2.asset${assets.length+2}`),null);
    }
  });
}
