import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, realpath, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await mkdtemp(join(await realpath(tmpdir()), "nexus-package-"));
const prefix = join(temp, "prefix");
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run with npm run test:package.");
function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: temp, encoding: "utf8", timeout: 180000, ...options });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
try {
  const metadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const [packed] = JSON.parse(run(process.execPath, [npmCli, "pack", "--json", "--ignore-scripts", "--pack-destination", temp], { cwd: root }));
  assert.deepEqual(packed.files.map(f => f.path).sort(), ["README.md", "dist/src/auth.js", "dist/src/bin.js", "dist/src/cli.js", "dist/src/client.js", "dist/src/downloads.js", "dist/src/hosted.js", "dist/src/maven-import.js", "dist/src/mutations.js", "dist/src/reads.js", "package.json"]);
  console.log("Archive allowlist passed (11 files). Installing dependencies; this phase may use npm network access.");
  run(process.execPath, [npmCli, "install", "--global", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", join(temp, packed.filename)]);
  const guard = join(temp, "offline.cjs");
  await writeFile(guard, 'const net = require("node:net"); net.Socket.prototype.connect = function () { throw new Error("Network disabled in package smoke"); }; globalThis.fetch = async (url, init) => { if (String(url).endsWith("/components?repository=releases") && init.body.get("maven2.generate-pom") === "false" && init.body.get("maven2.asset1.extension") === "pom" && await init.body.get("maven2.asset1").text() === "<project>original dependencies</project>" && await init.body.get("maven2.asset2").text() === "synthetic jar" && init.body.get("maven2.groupId") === null) return new Response(null,{status:204}); if(String(url).includes("/search/assets/download?")) return new Response(null,{status:302,headers:{location:"https://nexus.example.test/content/download.jar"}}); if(String(url).endsWith("/assets/known")) return Response.json({path:"download.jar",downloadUrl:"https://nexus.example.test/content/download.jar"}); if(String(url).endsWith("/content/download.jar")) return new Response("offline download"); if (String(url).endsWith("/repositories/raw/hosted") && init.method === "POST" && JSON.parse(init.body).storage.blobStoreName === "existing") return new Response(null,{status:201}); if (String(url).endsWith("/repositories/raw/hosted/releases")) return Response.json({name:"releases",online:true,storage:{blobStoreName:"existing",writePolicy:"ALLOW_ONCE",strictContentTypeValidation:true},cleanup:null,component:{proprietaryComponents:false},raw:{contentDisposition:"ATTACHMENT"}}); if (String(url) === "https://nexus.example.test/context/service/rest/v1/components?repository=releases" && init.method === "POST" && init.body.get("maven2.version") === "1.0" && await init.body.get("maven2.asset1").text() === "synthetic jar") return new Response(null,{status:204}); if (String(url) === "https://nexus.example.test/context/service/rest/v1/assets?repository=releases") return new Response(JSON.stringify({items: [{id:"offline-asset",path:"widget"}], continuationToken:null}), {headers:{"content-type":"application/json"}}); throw new Error("Network disabled in package smoke"); };');
  const home = join(temp, "home");
  await mkdir(home);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: home, USERPROFILE: home, APPDATA: home, XDG_CONFIG_HOME: home, NODE_OPTIONS: "--require " + JSON.stringify(guard) };
  const windows = process.platform === "win32";
  const executable = join(prefix, windows ? "nexus-cli.cmd" : "bin/nexus-cli");
  const invoke = args => windows
    ? run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", '"' + executable + '" ' + args.join(" ")], { env })
    : run(executable, args, { env });
  assert.match(invoke(["--help"]), /Usage: nexus-cli/);
  assert.equal(invoke(["--version"]).trim(), metadata.version);
  assert.match(invoke(["repositories", "list", "--help"]), /List visible repositories/);
  assert.match(invoke(["profile", "configure", "public", "--url", "https://nexus.example.test:443/context", "--auth-mode", "anonymous", "--json"]), /anonymousConfigured/);
  assert.match(invoke(["profile", "show", "public", "--json"]), /:443\/context/);
  assert.equal(JSON.parse(invoke(["assets", "list", "--repository", "releases", "--profile", "public", "--json"])).items[0].id, "offline-asset");
  const downloaded=JSON.parse(invoke(["assets","download","known","--profile","public","--json"]));
  assert.equal(await readFile(downloaded.path,"utf8"),"offline download");
  const searched = JSON.parse(invoke(["search","download","--name","widget","--output",join(temp,"searched.jar"),"--profile","public","--json"]));
  assert.equal(await readFile(searched.path,"utf8"),"offline download");
  const failure = spawnSync(executable,["assets","download","known","--profile","public","--json"],{env,cwd:temp,encoding:"utf8",timeout:30000});
  assert.equal(failure.status,1);
  assert.equal(JSON.parse(failure.stdout).published,false);
  assert.equal(JSON.parse(failure.stderr).error.code,"nexus.downloadFailed");
  const rpc = spawnSync(executable,["--json-rpc"],{env,cwd:temp,encoding:"utf8",timeout:30000,input:JSON.stringify({jsonrpc:"2.0",id:1,method:"cli.execute",params:{argv:["assets","download","known","--profile","public"]}})+"\n"});
  assert.equal(rpc.status,0);
  assert.equal(JSON.parse(rpc.stdout).error.data.result.published,false);
  console.log("Installed asset/search download and JSON/RPC failure output passed offline.");
  const jar = join(temp, "widget.jar");
  await writeFile(jar, "synthetic jar");
  invoke(["permissions", "grant", "Update", "--profile", "public"]);
  const hosted = ["repositories", "hosted", "raw"];
  const get = [...hosted, "get", "releases", "--profile", "public"];
  assert.equal(JSON.parse(invoke([...get, "--json"])).storage.writePolicy, "ALLOW_ONCE");
  assert.match(invoke(get), /ALLOW_ONCE/);
  const create = [...hosted, "create", "releases", "--blob-store", "existing", "--write-policy", "ALLOW_ONCE", "--online", "true", "--strict-content-type-validation", "true", "--profile", "public"];
  assert.equal(JSON.parse(invoke([...create, "--json"])).acknowledged, true);
  assert.match(invoke(create), /releases/);
  const upload = ["components", "upload", "maven", "--repository", "releases", "--group", "com.example", "--artifact", "widget", "--artifact-version", "1.0", "--extension", "jar", "--file", jar, "--profile", "public"];
  assert.equal(JSON.parse(invoke([...upload, "--json"])).acknowledged, true);
  assert.match(invoke(upload), /releases/);
  const pom = join(temp, "widget.pom");
  await writeFile(pom, "<project>original dependencies</project>");
  const imported = ["components", "upload", "maven", "--repository", "releases", "--pom", pom, "--asset", JSON.stringify({file:jar,extension:"jar"}), "--profile", "public"];
  assert.equal(JSON.parse(invoke([...imported,"--json"])).acknowledged,true);
  assert.match(invoke(imported),/releases/);
  console.log("Installed original POM import passed offline.");
  console.log("Installed executable help/version passed with network blocked and isolated user directories.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
