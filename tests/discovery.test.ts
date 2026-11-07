import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { createCli, diagnosticCause } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createDefinition } from "../src/cli.js";
import { offlineCli } from "./offline.js";

const origin = "https://nexus.example.test/context";
const base = origin + "/service/rest/v1/";
const routes = [
  { path: "blobstores", argv: ["blobstores", "list"], empty: /No blob stores/ },
  { path: "formats/upload-specs", argv: ["formats", "upload-specs", "list"], empty: /No upload specifications/ },
];
const specification = {
  format: "raw", multipleUpload: true,
  componentFields: [{ name: "directory", type: "string", optional: false }],
  assetFields: [{ name: "filename", type: "string", optional: true }],
};
const samples = [[{ name: "existing", type: "File" }], [specification]];
const marker = "SYNTHETIC_RESPONSE_PRIVATE";
const modes = ["human", "json", "rpc"] as const;
async function setup(t: TestContext, respond: () => Response) {
  const requests: string[] = [];
  const cli = await offlineCli(t, http.get("*", ({ request }) => {
    requests.push(request.url);
    return respond();
  }));
  assert.equal((await cli.fixture.run(cli.app, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"])).exitCode, 0);
  return { ...cli, requests };
}
async function invoke(cli: Awaited<ReturnType<typeof setup>>, argv: string[], mode: typeof modes[number], verbose = false) {
  const args = [...argv, "--profile", "lab", ...(verbose ? ["--verbose"] : [])];
  if (mode === "rpc") {
    const reply: any = (await cli.fixture.rpc(cli.app, [args]))[0];
    return { exitCode: reply.error?.data.exitCode ?? 0, data: reply.result, error: reply.error?.data, stdout: reply.result === undefined ? "" : JSON.stringify(reply.result), stderr: reply.error ? JSON.stringify(reply.error) : "" };
  }
  const r = await cli.fixture.run(cli.app, [...args, ...(mode === "json" ? ["--json"] : [])]);
  return { ...r, data: mode === "json" && r.stdout ? JSON.parse(r.stdout) : undefined, error: mode === "json" && r.stderr ? JSON.parse(r.stderr).error : undefined };
}

test("S30 pinned schema independently identifies both array responses and field scopes", () => {
  const bytes = readFileSync("docs/api/nexus-openapi.json");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "2d5261f26dd225103e886c0cb2becfa710b690a19e308a504cdd57a9293407ca");
  const d = JSON.parse(bytes.toString());
  for (const [path, operation, model] of [["/v1/blobstores", "listBlobstores", "GenericBlobStoreApiResponse"], ["/v1/formats/upload-specs", "listFormatsUploadSpecs", "UploadDefinitionXO"]]) {
    const op = d.paths[path].get;
    assert.equal(op.operationId, operation);
    assert.deepEqual(op.responses["200"].content["application/json"].schema, {type: "array", items: {$ref: "#/components/schemas/" + model}});
  }
  for (const key of ["name", "type"]) assert.equal(d.components.schemas.GenericBlobStoreApiResponse.properties[key].type, "string");
  for (const key of ["componentFields", "assetFields"]) assert.deepEqual(d.components.schemas.UploadDefinitionXO.properties[key], {type: "array", items: {$ref: "#/components/schemas/UploadFieldDefinitionXO"}});
  assert.equal(d.components.schemas.UploadFieldDefinitionXO.properties.optional.type, "boolean");
  assert.equal(d.components.schemas.UploadFieldDefinitionXO.properties.type.type, "string");
});

for (const [index, route] of routes.entries()) {
  test(`S30 ${route.path} useful projection, exact request and empty success in every mode`, async t => {
    let empty = false;
    const sample = index === 0 ? [{...samples[0][0], softQuotaAttributes: {attributes: {private: marker}}, future: marker}]
      : [{...specification, future: marker, componentFields: [{...specification.componentFields[0], description: marker, options: {private: marker}}]}];
    const cli = await setup(t, () => HttpResponse.json(empty ? [] : sample));
    for (const mode of modes) {
      const r = await invoke(cli, route.argv, mode);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.equal(r.stderr, "");
      assert.doesNotMatch(r.stdout, new RegExp(marker));
      if (mode === "human") {
        if (index === 0) { assert.match(r.stdout, /existing/); assert.match(r.stdout, /File/); }
        else {
          assert.match(r.stdout, /raw/); assert.match(r.stdout, /[Cc]omponent fields/); assert.match(r.stdout, /[Aa]sset fields/);
          assert.match(r.stdout, /directory: required \(string\)/); assert.match(r.stdout, /filename: optional \(string\)/);
        }
      } else assert.deepEqual(r.data, samples[index]);
    }
    empty = true;
    for (const mode of modes) {
      const r = await invoke(cli, route.argv, mode);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.equal(r.stderr, "");
      if (mode === "human") assert.match(r.stdout, route.empty);
      else assert.deepEqual(r.data, []);
    }
    assert.deepEqual(cli.requests, Array(6).fill(base + route.path));
  });

  test(`S30 ${route.path} ReadOnly gate denies every mode before HTTP`, async t => {
    const cli = await setup(t, () => HttpResponse.json([]));
    await cli.fixture.run(cli.app, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
    for (const mode of modes) {
      const r = await invoke(cli, route.argv, mode);
      assert.equal(r.exitCode, 1);
      assert.equal(r.stdout, "");
      if (mode !== "human") assert.equal(r.error.code, "permission.denied");
      else assert.match(r.stderr, /permissions grant ReadOnly/);
    }
    assert.deepEqual(cli.requests, []);
  });

  for (const status of [401, 403, 500]) test(`S30 ${route.path} distinct safe HTTP ${status}`, async t => {
    const cli = await setup(t, () => new HttpResponse(marker + "\u001b[31m", {status}));
    for (const mode of modes) {
      const r = await invoke(cli, route.argv, mode, true);
      assert.equal(r.exitCode, 1);
      assert.equal(r.stdout, "");
      assert.doesNotMatch(r.stderr, new RegExp(marker + "|\\u001b"));
      if (status === 401) assert.match(r.stderr, /authentication was rejected/);
      if (status === 403) { assert.match(r.stderr, /denied this action/); assert.doesNotMatch(r.stderr, /rejected|auth login/); }
      if (mode !== "human") assert.equal(r.error.code, status === 401 ? "http.unauthorized" : status === 403 ? "http.forbidden" : "http.serverError");
    }
    assert.equal(cli.requests.length, 3);
  });

  const malformed = index === 0
    ? [null, {}, [null], [{name: "valid", type: "File"}, {name: "bad", type: 3}], [{name: [], type: "File"}], [{name: "bad\u001b[31m", type: "File"}]]
    : [null, {}, [null], [{...specification, multipleUpload: "true"}], [{...specification, componentFields: {}}], [{...specification, assetFields: [null]}], [{...specification, assetFields: [{name: "field", optional: "false"}]}], [{...specification, assetFields: [{name: "field", optional: false, type: []}]}]];
  for (const [i, value] of malformed.entries()) test(`S30 ${route.path} rejects shape ${i} without partial data`, async t => {
    const cli = await setup(t, () => HttpResponse.json(value));
    const r = await invoke(cli, route.argv, "json");
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    assert.equal(r.error.code, "nexus.decodeFailed");
    assert.equal(cli.requests.length, 1);
  });

  for (const fault of ["syntax", "utf8", "bytes", "items", "label"]) test(`S30 ${route.path} ${fault} limit is safe in every mode`, async t => {
    const cli = await setup(t, () => {
      if (fault === "syntax") return new HttpResponse('{"' + marker + '":');
      if (fault === "utf8") return new HttpResponse(new Uint8Array([0xff]));
      if (fault === "bytes") return new HttpResponse(" ".repeat(4194304) + marker);
      if (fault === "items") return HttpResponse.json(Array(1001).fill(samples[index][0]));
      return HttpResponse.json(index === 0 ? [{name: "é".repeat(129), type: "File"}] : [{...specification, format: "é".repeat(129)}]);
    });
    for (const mode of modes) {
      const r = await invoke(cli, route.argv, mode, true);
      assert.equal(r.exitCode, 1);
      assert.equal(r.stdout, "");
      assert.doesNotMatch(r.stderr, new RegExp(marker));
      assert.ok(r.stderr.length < 20000, "diagnostic remains bounded");
      if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed");
    }
    assert.equal(cli.requests.length, 3);
  });

  test(`S30 ${route.path} exact entry and UTF-8 label bounds succeed`, async t => {
    const value = index === 0 ? {name: "é".repeat(128), type: "x".repeat(256)} : {...specification, format: "é".repeat(128)};
    const cli = await setup(t, () => HttpResponse.json(Array(1000).fill(value)));
    const r = await invoke(cli, route.argv, "json");
    assert.equal(r.exitCode, 0, r.stderr);
    assert.equal(r.data.length, 1000);
    assert.deepEqual(r.data[0], value);
  });
}

for (const scope of ["componentFields", "assetFields"]) test(`S30 upload ${scope} exact field bounds and overflow`, async t => {
  let size = 64;
  let field = {name: "é".repeat(128), type: "x".repeat(256), optional: false};
  const cli = await setup(t, () => HttpResponse.json([{...specification, [scope]: Array(size).fill(field)}]));
  const argv = routes[1].argv;
  assert.equal((await invoke(cli, argv, "json")).data[0][scope].length, 64);
  size = 65;
  let r = await invoke(cli, argv, "rpc");
  assert.equal(r.error.code, "nexus.decodeFailed");
  assert.equal(r.stdout, "");
  size = 1;
  field = {...field, type: "x".repeat(257)};
  r = await invoke(cli, argv, "json");
  assert.equal(r.error.code, "nexus.decodeFailed");
  assert.equal(r.stdout, "");
});

test("S30 existing format get shares scoped projection and field bounds", async t => {
  let size = 1;
  const cli = await setup(t, () => HttpResponse.json({...specification, future: marker, componentFields: Array(size).fill({...specification.componentFields[0], description: marker})}));
  const argv = ["formats", "upload-specs", "get", "raw"];
  for (const mode of modes) {
    const r = await invoke(cli, argv, mode);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.doesNotMatch(r.stdout, new RegExp(marker));
    if (mode === "human") { assert.match(r.stdout, /Component fields/); assert.match(r.stdout, /Asset fields/); }
    else assert.deepEqual(r.data, specification);
  }
  size = 65;
  const r = await invoke(cli, argv, "json");
  assert.equal(r.exitCode, 1);
  assert.equal(r.stdout, "");
  assert.equal(r.error.code, "nexus.decodeFailed");
  assert.deepEqual(cli.requests, Array(4).fill(base + "formats/raw/upload-specs"));
});

for (const denied of ["server", "local"]) test(`S30 ${denied} discovery denial still permits known-name raw create and upload`, async t => {
  const requests: string[] = [];
  const cli = await offlineCli(t, http.all("*", async ({request}) => {
    const url = new URL(request.url);
    requests.push(request.method + " " + url.pathname + url.search);
    if (url.pathname.endsWith("/blobstores")) return new HttpResponse(marker, {status: 403});
    if (url.pathname.endsWith("/repositories/raw/hosted")) {
      assert.equal((await request.json() as any).storage.blobStoreName, "known-permitted");
      return new HttpResponse(null, {status: 201});
    }
    assert.equal(request.method, "POST");
    assert.equal(url.pathname, "/context/service/rest/v1/components");
    assert.equal(url.search, "?repository=releases");
    const form = await request.formData();
    assert.equal(await (form.get("raw.asset1") as File).text(), "synthetic upload");
    assert.equal(form.get("raw.asset1.filename"), "artifact.bin");
    return new HttpResponse(null, {status: 204});
  }));
  const f = cli.fixture, a = cli.app;
  await f.run(a, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"]);
  if (denied === "local") await f.run(a, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
  const failure = await f.run(a, ["blobstores", "list", "--profile", "lab", "--json"]);
  assert.equal(JSON.parse(failure.stderr).error.code, denied === "server" ? "http.forbidden" : "permission.denied");
  await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"]);
  const created = await f.run(a, ["repositories", "hosted", "raw", "create", "releases", "--blob-store", "known-permitted", "--write-policy", "ALLOW_ONCE", "--online", "true", "--strict-content-type-validation", "true", "--profile", "lab", "--json"]);
  assert.equal(created.exitCode, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).acknowledged, true);
  const file = join(f.root, "artifact.bin");
  await writeFile(file, "synthetic upload");
  const uploaded = await f.run(a, ["components", "upload", "raw", "--repository", "releases", "--directory", "/", "--file", file, "--profile", "lab", "--json"]);
  assert.equal(uploaded.exitCode, 0, uploaded.stderr);
  assert.equal(JSON.parse(uploaded.stdout).acknowledged, true);
  assert.deepEqual(requests, [...(denied === "server" ? ["GET /context/service/rest/v1/blobstores"] : []), "POST /context/service/rest/v1/repositories/raw/hosted", "POST /context/service/rest/v1/components?repository=releases"]);
});

for (const route of routes) for (const phase of ["transport", "body"]) test(`S30 ${route.path} nested ${phase} diagnostics preserve evidence and redact resources`, async t => {
  const password = "SYNTHETIC_PASSWORD_é_[p]";
  const f = await createCliFixture(t, {applicationId: "nexus-cli", profiles: [{name: "lab", values: {url: origin, authMode: "basic"}, secrets: {credentials: JSON.stringify({username: "synthetic-user", password})}}]});
  let calls = 0;
  const a = f.createApplication(runtime => createCli({...createDefinition(), runtime: {...runtime, fetch: async input => {
    calls++;
    const url = String(input);
    const native = Object.assign(new Error("socket failed " + encodeURIComponent(url).toLowerCase() + " " + password + "\u001b\u0085"), {code: "ECONNRESET"});
    native.stack = native.name + ": " + native.message + "\n    at syntheticTransport (discovery-native.js:17:3)";
    const cause = diagnosticCause(new AggregateError([Object.assign(new Error("related " + new URL(url).pathname), {code: 73})], "related operations failed", {cause: native}));
    if (phase === "transport") throw cause;
    return new Response(new ReadableStream({start(controller) {controller.error(cause);}}));
  }}}));
  // Reuse only invocation plumbing; transport and the actual command/decoder remain real.
  const cli = {fixture: f, app: a, requests: []} as unknown as Awaited<ReturnType<typeof setup>>;
  for (const verbose of [false, true]) for (const mode of modes) {
    const r = await invoke(cli, route.argv, mode, verbose);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    assert.doesNotMatch(r.stderr, /SYNTHETIC_PASSWORD|nexus\.example\.test|%3a%2f%2f|\/context\/service|[\u001b\u0085]/);
    assert.match(r.stderr, /socket failed/);
    if (mode !== "human") {
      assert.match(r.stderr, /ECONNRESET/); assert.match(r.stderr, /73/);
      assert.equal(r.error.code, phase === "transport" ? "nexus.requestFailed" : "nexus.decodeFailed");
    }
    if (verbose) assert.match(r.stderr, /discovery-native\.js:17:3/);
    else if (mode === "human") { assert.ok(r.stderr.trim().split("\n").length <= 3); assert.doesNotMatch(r.stderr, /discovery-native/); }
  }
  assert.equal(calls, 6);
});


test("S30 sparse long field scopes do not amplify human output", async t => {
  const longField = {name:"n".repeat(256),type:"t".repeat(256),optional:false};
  const specs = Array.from({length:1000},(_,i)=>({format:`format-${i}`,multipleUpload:false,
    componentFields:i===999?Array(64).fill(longField):[],assetFields:i===999?Array(64).fill(longField):[]}));
  const cli = await setup(t,()=>HttpResponse.json(specs));
  const human = await invoke(cli,routes[1].argv,"human");
  assert.equal(human.exitCode,0,human.stderr);
  assert.ok(Buffer.byteLength(human.stdout)<1024*1024,"sparse scopes must not pad unrelated specifications");
  assert.match(human.stdout,/format-999/);assert.match(human.stdout,new RegExp(longField.name+": required"));
  for(const mode of ["json","rpc"] as const) assert.deepEqual((await invoke(cli,routes[1].argv,mode)).data,specs);
});
