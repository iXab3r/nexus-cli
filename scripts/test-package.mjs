import { ciRoundtrip } from "./test-ci-roundtrip.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, realpath, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run with npm run test:package.");
const tarball = process.argv[2] === "--tarball" ? process.argv[3] : undefined;
const version = tarball === undefined ? process.argv[2] : undefined;
assert.ok(process.argv.length <= (tarball ? 4 : 3), "Pass --tarball <absolute-path> or one registry version.");
assert.ok(process.argv[2] !== "--tarball" || (tarball && isAbsolute(tarball)), "Pass an absolute tarball path.");
assert.ok(version === undefined || /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version), "Pass a registry version.");
const temp = await mkdtemp(join(await realpath(tmpdir()), "nexus-package-"));
const prefix = join(temp, "prefix");
const nativeBytes = "offline native selection";
const nativeDigest = createHash("sha256").update(nativeBytes).digest("hex");
const uploadSpecification = {format:"raw",multipleUpload:true,
  componentFields:[{name:"directory",type:"STRING",optional:false,description:"Repository path",group:"Component attributes",groupHelpText:"Directory scope",options:{root:"Root directory"}}],
  assetFields:[{name:"filename",type:"STRING",optional:true,description:"Filename\nhelp",group:null,groupHelpText:null,options:null},
    {name:"asset",type:"FILE",optional:false,description:null,group:null,groupHelpText:null,options:null}]};
const installEnv = { ...process.env };
for (const key of Object.keys(installEnv)) if (/token|^npm_config_|^node_options$|^node_path$/i.test(key)) delete installEnv[key];
function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: temp, env: installEnv, encoding: "utf8", timeout: 180000, ...options });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `Package check failed (status ${result.status}).`);
  return result.stdout;
}
function npm(args, options) {
  return run(process.execPath, [npmCli, ...args, "--cache", join(temp, "cache"), "--userconfig", join(temp, "npmrc"),
    "--globalconfig", join(temp, "global-npmrc"), "--registry", "https://registry.npmjs.org/"], options);
}
try {
  await writeFile(join(temp, "npmrc"), "");
  await writeFile(join(temp, "global-npmrc"), "");
  const metadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.ok(version === undefined || version === metadata.version, "Registry version must match this source revision.");
  let source = tarball;
  if (source === undefined) {
    const [packed] = JSON.parse(npm(["pack", ...(version ? [`${metadata.name}@${version}`] : []), "--json", "--ignore-scripts", "--pack-destination", temp], { cwd: root }));
    assert.equal(packed.name, metadata.name);
    assert.equal(packed.version, metadata.version);
    source = join(temp, packed.filename);
  }
  const members = run("tar", ["-tzf", source]).trim().split("\n");
  assert.deepEqual(members.sort(), ["README.md", "dist/src/auth.js", "dist/src/bin.js", "dist/src/cli.js", "dist/src/client.js", "dist/src/diagnostics.js", "dist/src/discovery.js", "dist/src/downloads.js", "dist/src/hosted.js", "dist/src/maven-import.js", "dist/src/metadata.js", "dist/src/mutations.js", "dist/src/reads.js", "dist/src/search.js", "package.json"].map(path => "package/" + path).sort());
  console.log("Archive allowlist passed (15 files). Installing dependencies; this phase may use npm network access.");
  npm(["install", "--global", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", source]);
  const installed = join(prefix, ...(process.platform === "win32" ? [] : ["lib"]), "node_modules", "@eyeauras", "nexus-cli");
  const installedMetadata = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
  assert.equal(installedMetadata.name, metadata.name);
  assert.equal(installedMetadata.version, metadata.version);
  assert.deepEqual(installedMetadata.dependencies, metadata.dependencies);
  const resolved = JSON.parse(run(process.execPath, ["--input-type=module", "--eval", 'console.log(JSON.stringify(import.meta.resolve("@eyeauras/cli-factory")))'], {cwd:installed}));
  assert.ok(!relative(prefix, await realpath(fileURLToPath(resolved))).startsWith(".."), "Core must resolve inside the isolated installation.");
  const guard = join(temp, "offline.cjs");
  await writeFile(guard, 'const net = require("node:net"); net.Socket.prototype.connect = function () { throw new Error("Network disabled in package smoke"); }; globalThis.fetch = async (url, init) => { if (String(url).endsWith("/components?repository=releases") && init.body.get("maven2.generate-pom") === "false" && init.body.get("maven2.asset1.extension") === "pom" && await init.body.get("maven2.asset1").text() === "<project>original dependencies</project>" && await init.body.get("maven2.asset2").text() === "synthetic jar" && init.body.get("maven2.groupId") === null) return new Response(null,{status:204}); if(String(url).endsWith("/context/repository/releases/direct.bin")) return new Response("offline download"); if(String(url).includes("/search/assets/download?")) { const q = new URL(url).searchParams; if(q.get("name") === "ambiguous") { require("node:assert/strict").equal(q.has("sort"),false); return new Response("synthetic ambiguity",{status:400}); } if(q.has("sort")) { require("node:assert/strict").deepEqual(Object.fromEntries(q),{repository:"snapshots",name:"widget",version:"1.2-20261107.123456-4","maven.baseVersion":"1.2-SNAPSHOT","maven.extension":"jar","maven.classifier":"",sort:"version",direction:"desc",prerelease:"false"}); return new Response(null,{status:302,headers:{location:"https://nexus.example.test/content/widget-selected.jar"}}); } return new Response(null,{status:302,headers:{location:"https://nexus.example.test/content/download.jar"}}); } if(String(url).endsWith("/content/widget-selected.jar")) return new Response("offline selected snapshot"); if(String(url).endsWith("/assets/known")) return Response.json({path:"download.jar",downloadUrl:"https://nexus.example.test/content/download.jar"}); if(String(url).endsWith("/content/download.jar")) return new Response("offline download"); if (String(url).endsWith("/repositories/raw/hosted") && init.method === "POST" && JSON.parse(init.body).storage.blobStoreName === "existing") return new Response(null,{status:201}); if (String(url).endsWith("/repositories/raw/hosted/releases")) return Response.json({name:"releases",online:true,storage:{blobStoreName:"existing",writePolicy:"ALLOW_ONCE",strictContentTypeValidation:true},cleanup:null,component:{proprietaryComponents:false},raw:{contentDisposition:"ATTACHMENT"}}); if (String(url) === "https://nexus.example.test/context/service/rest/v1/components?repository=releases" && init.method === "POST" && init.body.get("maven2.version") === "1.0" && await init.body.get("maven2.asset1").text() === "synthetic jar") return new Response(null,{status:204}); if (String(url) === "https://nexus.example.test/context/service/rest/v1/assets?repository=releases") return new Response(JSON.stringify({items: [{id:"offline-asset",path:"widget"}], continuationToken:null}), {headers:{"content-type":"application/json"}}); throw new Error("Network disabled in package smoke"); };');

  // Discovery has its own fixtures; the existing transfers retain their guard.
  const discoveryRequests = join(temp, "discovery-requests.txt");
  await writeFile(guard, `
const existingFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  require("node:fs").appendFileSync(${JSON.stringify(discoveryRequests)}, (init.method ?? "GET") + " " + url.pathname + url.search + "\\n");
  if (url.pathname === "/context/service/rest/v1/repositories" || url.pathname === "/context/service/rest/v1/repositories/maven-proxy") {
    require("node:assert/strict").equal(init.method ?? "GET", "GET");
    const repository = '{"name":"maven-proxy","format":"maven2","type":"proxy","online":false,"url":"https://SYNTHETIC_USER:SYNTHETIC_PASSWORD@nexus.example.test/context/repository/maven-proxy?token=SYNTHETIC_QUERY#SYNTHETIC_HASH","size":9007199254740993,"attributes":{"proxy":{"remoteUrl":"https://SYNTHETIC_USER:SYNTHETIC_PASSWORD@upstream.example.test/maven2?token=SYNTHETIC_QUERY#SYNTHETIC_HASH","password":"SYNTHETIC_ATTRIBUTE"},"internal":{"secret":"SYNTHETIC_CONFIG"}}}';
    return new Response(url.pathname.endsWith("/repositories") ? '[' + repository + ']' : repository);
  }
  if (url.searchParams.get("q") === "SYNTHETIC PRIVATE SELECTOR") {
    throw Object.assign(new Error("synthetic socket failed " + url.searchParams), {code:"ECONNRESET"});
  }
  if (url.searchParams.get("q") === "M9_PRIVATE_SELECTOR_PREFIX https://synthetic:private@host.example.test") {
    throw Object.assign(new Error("synthetic socket failed (M9_PRIVATE_SELECTOR_PREFIX https://redacted@host.example.test);/ context"), {code:"ECONNRESET"});
  }
  if (url.searchParams.get("q")?.startsWith("M9_PRIVATE_SELECTOR_PREFIX")) {
    throw Object.assign(new Error("synthetic socket failed M9_PRIVATE_SELECTOR_PREFIX token=[redacted]"), {code:"ECONNRESET"});
  }
  if (url.pathname.endsWith("/quota-status")) {
    require("node:assert/strict").equal(init.method ?? "GET", "GET");
    require("node:assert/strict").equal(url.search, "");
    const violated = url.pathname.includes("/violating/");
    return Response.json({blobStoreName:violated ? "violating" : "existing",isViolation:violated,message:violated ? "Quota exceeded" : "Quota available"});
  }
  if (url.pathname.endsWith("/assets/exact")) return new Response('{"id":"exact","fileSize":9223372036854775807}');
  if (url.pathname.endsWith("/components/exact")) return new Response('{"id":"component","assets":[{"id":"exact","fileSize":-9223372036854775808}]}');
  if (url.searchParams.get("repositoryName") === "native-select") {
    require("node:assert/strict").deepEqual(Object.fromEntries(url.searchParams), {repositoryName:"native-select",sha256:${JSON.stringify(nativeDigest)},timeout:"10"});
    if (url.pathname.endsWith("/search/assets/download")) return new Response(null,{status:302,headers:{location:"https://nexus.example.test/content/native-selected.bin"}});
    const item = url.pathname.endsWith("/search/assets") ? '{"id":"native","fileSize":9223372036854775807}'
      : '{"id":"component","assets":[{"id":"native","fileSize":9223372036854775807}]}';
    return new Response('{"items":['+item+'],"continuationToken":null}');
  }
  if (url.pathname.endsWith("/content/native-selected.bin")) return new Response(${JSON.stringify(nativeBytes)});
  if (url.pathname.endsWith("/blobstores")) return url.pathname.includes("/denied/")
    ? new Response("synthetic private response", {status:403})
    : Response.json([{name:"existing",type:"File",softQuotaAttributes:{private:"omitted"}}]);
  if (url.pathname.endsWith("/formats/upload-specs")) return Response.json([{...${JSON.stringify(uploadSpecification)},future:"SYNTHETIC_UNKNOWN_UPLOAD"}]);
  if (url.pathname.endsWith("/formats/raw/upload-specs")) return Response.json({...${JSON.stringify(uploadSpecification)},future:"SYNTHETIC_UNKNOWN_UPLOAD"});
  if (url.pathname.endsWith("/components") && init.body instanceof FormData && init.body.has("raw.asset1")) {
    require("node:assert/strict").equal(await init.body.get("raw.asset1").text(),"synthetic raw");
    return new Response(null,{status:204});
  }
  return existingFetch(input,init);
};
`, {flag: "a"});
  // Load the installed native binding, but forbid OS credential access in this offline smoke.
  const secrets = join(temp, "secrets.mjs");
  await writeFile(secrets, `
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { relative } from "node:path";
import { PlatformSecretStore, MemorySecretStore } from ${JSON.stringify(new URL("./secret-store.js", resolved).href)};
if (process.platform !== "win32") {
  const require = createRequire(${JSON.stringify(resolved)});
  const { Entry } = require("@napi-rs/keyring");
  const bindings = Object.keys(require.cache).filter(path => path.endsWith(".node"));
  assert.ok(bindings.length > 0, "The installed native credential binding must load.");
  for (const path of bindings) assert.ok(!relative(${JSON.stringify(prefix)}, realpathSync(path)).startsWith(".."), "Native bindings must resolve inside the isolated installation.");
  for (const method of ["getPassword", "setPassword", "deletePassword"]) {
    Entry.prototype[method] = () => { throw new Error("OS credential storage is disabled in package smoke."); };
  }
}
const memory = new MemorySecretStore();
for (const method of ["get", "set", "delete"]) PlatformSecretStore.prototype[method] = memory[method].bind(memory);
`);
  const home = join(temp, "home");
  await mkdir(home);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: home, USERPROFILE: home, APPDATA: home, XDG_CONFIG_HOME: home, NODE_OPTIONS: "--require " + JSON.stringify(guard) + " --import " + JSON.stringify(pathToFileURL(secrets).href) };
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

  const expectedRepository = {name:"maven-proxy",format:"maven2",type:"proxy",online:false,
    url:"https://nexus.example.test/context/repository/maven-proxy",size:"9007199254740993",
    attributes:{proxy:{remoteUrl:"https://upstream.example.test/maven2"}}};
  const repositoryCommands = [["repositories","list"],["repositories","get","maven-proxy"]];
  for (const command of repositoryCommands) {
    const args = [...command,"--profile","public"];
    const json = invoke([...args,"--json"]);
    assert.deepEqual(JSON.parse(json),command[1] === "list" ? [expectedRepository] : expectedRepository);
    const human = invoke(args);
    assert.match(human,/Reported size \(B\)/); assert.match(human,/9007199254740993/); assert.match(human,/upstream\.example\.test/);
    assert.doesNotMatch(human+json,/SYNTHETIC|PRIVATE/);
  }
  const repositoryRpc = run(executable,["--json-rpc"],{env,input:repositoryCommands.map((command,i) => JSON.stringify({jsonrpc:"2.0",id:i+1,method:"cli.execute",params:{argv:[...command,"--profile","public"]}})).join("\n")+"\n"});
  const repositoryReplies = repositoryRpc.trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(repositoryReplies.map(r => r.result),[[expectedRepository],expectedRepository]);
  assert.doesNotMatch(repositoryRpc,/SYNTHETIC|PRIVATE/);
  console.log("Installed exact repository sizes and private upstream projections passed in human/JSON/RPC.");

  const uploadCommands = [["formats","upload-specs","list"],["formats","upload-specs","get","raw"]];
  for (const command of uploadCommands) {
    const args = [...command,"--profile","public"];
    const json = invoke([...args,"--json"]);
    assert.deepEqual(JSON.parse(json),command[2] === "list" ? [uploadSpecification] : uploadSpecification);
    const human = invoke(args);
    for (const text of ["Repository path","Component attributes","Directory scope","Root directory","asset: required (FILE)"]) assert.ok(human.includes(text));
    assert.match(human,/Filename\\u000ahelp/); assert.doesNotMatch(json+human,/SYNTHETIC_UNKNOWN_UPLOAD/);
  }
  const uploadRpc = run(executable,["--json-rpc"],{env,input:uploadCommands.map((command,i) => JSON.stringify({jsonrpc:"2.0",id:i+1,method:"cli.execute",params:{argv:[...command,"--profile","public"]}})).join("\n")+"\n"});
  assert.deepEqual(uploadRpc.trim().split("\n").map(line => JSON.parse(line).result),[[uploadSpecification],uploadSpecification]);
  assert.doesNotMatch(uploadRpc,/SYNTHETIC_UNKNOWN_UPLOAD/);
  console.log("Installed complete upload-field metadata passed in human/JSON/RPC.");

  const quota = ["blobstores", "quota-status", "existing", "--profile", "public"];
  assert.deepEqual(JSON.parse(invoke([...quota, "--json"])), {blobStoreName:"existing",isViolation:false,message:"Quota available"});
  assert.match(invoke(quota), /Quota available/);
  const violation = ["blobstores", "quota-status", "violating", "--profile", "public"];
  const quotaFailure = spawnSync(executable, [...violation,"--json"], {env,cwd:temp,encoding:"utf8",timeout:30000});
  assert.equal(quotaFailure.status,1);
  assert.equal(JSON.parse(quotaFailure.stdout).isViolation,true);
  assert.equal(JSON.parse(quotaFailure.stderr).error.code,"nexus.blobstore.quotaViolation");
  const quotaRpc = run(executable,["--json-rpc"],{env,input:JSON.stringify({jsonrpc:"2.0",id:1,method:"cli.execute",params:{argv:violation}})+"\n"});
  assert.equal(JSON.parse(quotaRpc).error.data.result.isViolation,true);
  console.log("Installed quota status success and failure channels passed offline.");
  const exactSize = ["assets", "get", "exact", "--profile", "public"];
  assert.equal(JSON.parse(invoke([...exactSize,"--json"])).fileSize,"9223372036854775807");
  assert.match(invoke(exactSize),/9223372036854775807/);
  const exactRpc = run(executable,["--json-rpc"],{env,input:JSON.stringify({jsonrpc:"2.0",id:1,method:"cli.execute",params:{argv:["components","get","exact","--profile","public"]}})+"\n"});
  assert.equal(JSON.parse(exactRpc).result.assets[0].fileSize,"-9223372036854775808");
  console.log("Installed exact int64 metadata passed in human/JSON/RPC.");
  const nativeFlags = ["--filter",JSON.stringify({name:"repositoryName",value:"native-select"}),"--filter",JSON.stringify({name:"sha256",value:nativeDigest}),"--timeout","10","--profile","public"];
  assert.equal(JSON.parse(invoke(["search","assets",...nativeFlags,"--json"])).items[0].fileSize,"9223372036854775807");
  assert.match(invoke(["search","assets",...nativeFlags]),/9223372036854775807/);
  const nativeRpc = run(executable,["--json-rpc"],{env,input:JSON.stringify({jsonrpc:"2.0",id:1,method:"cli.execute",params:{argv:["search","components",...nativeFlags]}})+"\n"});
  assert.equal(JSON.parse(nativeRpc).result.items[0].assets[0].fileSize,"9223372036854775807");
  const nativeSaved = JSON.parse(invoke(["search","download",...nativeFlags,"--sha256",nativeDigest,"--output",join(temp,"native-selected.bin"),"--json"]));
  assert.equal(nativeSaved.verified,true);
  assert.equal(await readFile(nativeSaved.path,"utf8"),nativeBytes);
  const beforeDuplicate = await readFile(discoveryRequests,"utf8");
  const duplicateFlag = spawnSync(executable,["search","assets","--q","first","--q","second","--profile","public","--json"],{env,cwd:temp,encoding:"utf8",timeout:30000});
  assert.equal(duplicateFlag.status,2);
  assert.equal(duplicateFlag.stdout,"");
  assert.equal(JSON.parse(duplicateFlag.stderr).error.code,"usage");
  const duplicateRpc = run(executable,["--json-rpc"],{env,input:JSON.stringify({jsonrpc:"2.0",id:1,method:"cli.execute",params:{argv:["search","components","--continuation-token","first","--continuation-token","second","--profile","public"]}})+"\n"});
  assert.equal(JSON.parse(duplicateRpc).error.data.exitCode,2);
  assert.equal(await readFile(discoveryRequests,"utf8"),beforeDuplicate);
  const privateQuery = spawnSync(executable,["search","assets","--q","SYNTHETIC PRIVATE SELECTOR","--profile","public","--json"],{env,cwd:temp,encoding:"utf8",timeout:30000});
  assert.equal(privateQuery.status,1);
  assert.doesNotMatch(privateQuery.stdout+privateQuery.stderr,/SYNTHETIC|PRIVATE/);
  assert.match(privateQuery.stderr,/ECONNRESET/);
  const copiedQuery = spawnSync(executable,["search","assets","--q","M9_PRIVATE_SELECTOR_PREFIX token=SYNTHETIC_VALUE","--profile","public","--json"],{env,cwd:temp,encoding:"utf8",timeout:30000});
  assert.equal(copiedQuery.status,1);
  assert.doesNotMatch(copiedQuery.stdout+copiedQuery.stderr,/M9_PRIVATE_SELECTOR_PREFIX|SYNTHETIC_VALUE/);
  assert.match(copiedQuery.stderr,/ECONNRESET/);
  const contextualQuery = spawnSync(executable,["search","assets","--q","M9_PRIVATE_SELECTOR_PREFIX https://synthetic:private@host.example.test","--profile","public","--json"],{env,cwd:temp,encoding:"utf8",timeout:30000});
  assert.equal(contextualQuery.status,1);
  assert.doesNotMatch(contextualQuery.stdout+contextualQuery.stderr,/M9_PRIVATE_SELECTOR_PREFIX|host\.example\.test/);
  assert.match(contextualQuery.stderr,/ECONNRESET/);
  console.log("Installed native search selectors, timeout and digest distinction passed offline.");

  for (const [argv, expected, human] of [
    [["blobstores", "list"], [{name:"existing",type:"File"}], /existing/],
    [["formats", "upload-specs", "list"], [uploadSpecification], /directory: required/],
  ]) {
    assert.deepEqual(JSON.parse(invoke([...argv, "--profile", "public", "--json"])), expected);
    assert.match(invoke([...argv, "--profile", "public"]), human);
    const discoveryRpc = run(executable, ["--json-rpc"], {env, input:JSON.stringify({jsonrpc:"2.0",id:1,method:"cli.execute",params:{argv:[...argv,"--profile","public"]}})+"\n"});
    assert.deepEqual(JSON.parse(discoveryRpc).result, expected);
  }
  console.log("Installed S30 discovery human/JSON/RPC projections passed offline.");
  const downloaded=JSON.parse(invoke(["assets","download","known","--profile","public","--json"]));
  assert.equal(await readFile(downloaded.path,"utf8"),"offline download");
  const searched = JSON.parse(invoke(["search","download","--name","widget","--output",join(temp,"searched.jar"),"--profile","public","--json"]));
  assert.equal(await readFile(searched.path,"utf8"),"offline download");
  const selected = JSON.parse(invoke(["search", "download", "--repository", "snapshots", "--name", "widget", "--artifact-version", "1.2-20261107.123456-4", "--maven-base-version", "1.2-SNAPSHOT", "--maven-extension", "jar", "--maven-classifier", "", "--sort", "version", "--direction", "desc", "--prerelease", "false", "--profile", "public", "--json"]));
  assert.equal(selected.path, join(temp, "widget-selected.jar"));
  assert.equal(await readFile(selected.path, "utf8"), "offline selected snapshot");
  assert.equal(selected.bytes, Buffer.byteLength("offline selected snapshot"));
  assert.equal(selected.verified, false);
  assert.equal("version" in selected, false);
  const ambiguousPath = join(temp, "ambiguous.jar");
  const ambiguous = spawnSync(executable, ["search", "download", "--name", "ambiguous", "--output", ambiguousPath, "--profile", "public", "--json"], {env, cwd:temp, encoding:"utf8", timeout:30000});
  assert.equal(ambiguous.status, 1);
  assert.equal(ambiguous.stdout, "");
  assert.equal(JSON.parse(ambiguous.stderr).error.code, "http.rejected");
  await assert.rejects(readFile(ambiguousPath), {code:"ENOENT"});
  console.log("Installed S29 server selection, observed bytes and unordered ambiguity passed offline.");
  const direct=JSON.parse(invoke(["content","download","--repository","releases","--path","direct.bin","--profile","public","--json"]));
  assert.equal(await readFile(direct.path,"utf8"),"offline download");
  const unsafe=spawnSync(executable,["content","download","--repository","releases","--path","../unsafe","--profile","public","--json"],{env,cwd:temp,encoding:"utf8",timeout:30000});
  assert.equal(unsafe.status,2);
  assert.equal(JSON.parse(unsafe.stderr).error.code,"usage");
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

  invoke(["profile", "configure", "denied", "--url", "https://nexus.example.test/denied/context", "--auth-mode", "anonymous"]);
  invoke(["permissions", "grant", "Update", "--profile", "denied"]);
  await writeFile(discoveryRequests, "");
  const discoveryDenied = spawnSync(executable, ["blobstores", "list", "--profile", "denied", "--json"], {env, cwd:temp, encoding:"utf8", timeout:30000});
  assert.equal(discoveryDenied.status, 1);
  assert.equal(discoveryDenied.stdout, "");
  assert.equal(JSON.parse(discoveryDenied.stderr).error.code, "http.forbidden");
  assert.doesNotMatch(discoveryDenied.stderr, /synthetic private response/);
  assert.equal(JSON.parse(invoke([...create.slice(0, -2), "--profile", "denied", "--json"])).acknowledged, true);
  const rawFile = join(temp, "artifact.bin");
  await writeFile(rawFile, "synthetic raw");
  assert.equal(JSON.parse(invoke(["components", "upload", "raw", "--repository", "releases", "--directory", "/", "--file", rawFile, "--profile", "denied", "--json"])).acknowledged, true);
  assert.deepEqual((await readFile(discoveryRequests, "utf8")).trim().split("\n"), [
    "GET /denied/context/service/rest/v1/blobstores",
    "POST /denied/context/service/rest/v1/repositories/raw/hosted",
    "POST /denied/context/service/rest/v1/components?repository=releases",
  ]);
  console.log("Installed S30 denied discovery followed by raw create/upload passed without preflight.");
  const upload = ["components", "upload", "maven", "--repository", "releases", "--group", "com.example", "--artifact", "widget", "--artifact-version", "1.0", "--extension", "jar", "--file", jar, "--profile", "public"];
  assert.equal(JSON.parse(invoke([...upload, "--json"])).acknowledged, true);
  assert.match(invoke(upload), /releases/);
  const pom = join(temp, "widget.pom");
  await writeFile(pom, "<project>original dependencies</project>");
  const imported = ["components", "upload", "maven", "--repository", "releases", "--pom", pom, "--asset", JSON.stringify({file:jar,extension:"jar"}), "--profile", "public"];
  assert.equal(JSON.parse(invoke([...imported,"--json"])).acknowledged,true);
  assert.match(invoke(imported),/releases/);
  console.log("Installed original POM import passed offline.");
  await ciRoundtrip({root,temp,prefix,env,executable});
  console.log("Installed executable help/version passed with network blocked and isolated user directories.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
