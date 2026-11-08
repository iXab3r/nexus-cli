import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCli, diagnosticCause } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createDefinition } from "../src/cli.js";
import { offlineCli } from "./offline.js";

const origin = "https://nexus.example.test/context";
const leaves = ["list", "get"] as const;
type Leaf = typeof leaves[number];
const scopes = ["componentFields", "assetFields"] as const;
const modes = ["human", "json", "rpc"] as const;
const selected = { name: "extension", type: "SELECT", optional: false,
  description: "Artifact extension", group: "Coordinates", groupHelpText: "Choose the artifact coordinates",
  options: { jar: "Java archive", pom: "Original POM" } };
const specification = { format: "maven2", multipleUpload: true,
  componentFields: [{ ...selected, name: "packaging" }],
  assetFields: [selected, { name: "asset", type: "FILE", optional: false, description: null, group: null, groupHelpText: null, options: null }],
};
const argv = (leaf: Leaf, format = "maven2") => ["formats", "upload-specs", leaf, ...(leaf === "get" ? [format] : []), "--profile", "lab"];
const wrap = (leaf: Leaf, value: any) => leaf === "list" ? [value] : value;
const root = (leaf: Leaf, value: any) => leaf === "list" ? value[0] : value;
async function setup(t: TestContext, leaf: Leaf, respond: () => Response) {
  const requests: Request[] = [];
  const cli = await offlineCli(t, http.get(/.*/, ({ request }) => { requests.push(request); return respond(); }));
  assert.equal((await cli.fixture.run(cli.app, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"])).exitCode, 0);
  return { ...cli, leaf, requests };
}
async function invoke(cli: Awaited<ReturnType<typeof setup>>, mode: typeof modes[number], verbose = false) {
  const args = [...argv(cli.leaf), ...(verbose ? ["--verbose"] : [])];
  if (mode === "rpc") {
    const r: any = (await cli.fixture.rpc(cli.app, [args]))[0];
    return { exitCode: r.error?.data.exitCode ?? 0, data: r.result, error: r.error?.data,
      stdout: r.result === undefined ? "" : JSON.stringify(r.result), stderr: r.error ? JSON.stringify(r.error) : "" };
  }
  const r = await cli.fixture.run(cli.app, [...args, ...(mode === "json" ? ["--json"] : [])]);
  return { ...r, data: mode === "json" && r.stdout ? JSON.parse(r.stdout) : undefined,
    error: mode === "json" && r.stderr ? JSON.parse(r.stderr).error : undefined };
}

for (const leaf of leaves) test(`Q5 ${leaf} complete metadata and source FILE field in every mode`, async t => {
  const value = { ...specification, future: "SYNTHETIC_UNKNOWN_ROOT", componentFields: [{ ...specification.componentFields[0], future: "SYNTHETIC_UNKNOWN_FIELD" }] };
  const cli = await setup(t, leaf, () => HttpResponse.json(wrap(leaf, value)));
  for (const mode of modes) {
    const r = await invoke(cli, mode); assert.equal(r.exitCode, 0, r.stderr); assert.equal(r.stderr, "");
    assert.doesNotMatch(r.stdout, /SYNTHETIC_UNKNOWN/);
    if (mode !== "human") assert.deepEqual(root(leaf, r.data), specification);
    else for (const text of ["Component fields", "Asset fields", "Artifact extension", "Coordinates", "Choose the artifact coordinates", "Java archive", "Original POM", "asset: required (FILE)"])
      assert.ok(r.stdout.includes(text), text);
  }
  assert.equal(cli.requests.length, 3);
  for (const request of cli.requests) {
    assert.equal(request.url, origin + "/service/rest/v1/" + (leaf === "list" ? "formats/upload-specs" : "formats/maven2/upload-specs"));
    assert.equal(request.method, "GET"); assert.equal(request.headers.get("authorization"), null);
    assert.equal(request.headers.get("accept"), "application/json"); assert.equal(await request.text(), "");
  }
});

for (const leaf of leaves) for (const scope of scopes) test(`Q5 ${leaf} ${scope} preserves absent null and empty metadata`, async t => {
  let field: any = { name: "choice", optional: true };
  const cli = await setup(t, leaf, () => HttpResponse.json(wrap(leaf, { ...specification, [scope]: [field, field] })));
  for (const metadata of [{}, { description: null, group: null, groupHelpText: null, options: null },
    { description: "", group: "", groupHelpText: "", options: {} },
    { description: "Help", group: "Grouping", groupHelpText: "Group help", options: { "": "Empty option" } }]) {
    field = { name: "choice", optional: true, ...metadata };
    for (const mode of modes) {
      const r = await invoke(cli, mode); assert.equal(r.exitCode, 0);
      if (mode !== "human") assert.deepEqual(root(leaf, r.data)[scope], [field, field]);
      else if (metadata.description === null) assert.match(r.stdout, /not reported/);
      else if (metadata.description === "") { assert.match(r.stdout, /\(empty\)/); assert.match(r.stdout, /none/); }
    }
  }
});

for (const leaf of leaves) test(`Q5 ${leaf} options preserve own keys without prototype mutation or coercion`, async t => {
  const options = JSON.parse('{"__proto__":"Prototype label","constructor":"Constructor label","toString":"Text label","":"","line\\nkey":"<b>Literal choice</b>"}');
  const field = { ...selected, type: "STRING", description: "<p>Literal help\nnext\u001b[31m</p>", group: "Group\tname", groupHelpText: "Group\u009bhelp", options };
  const expected = { ...specification, assetFields: [field] };
  const cli = await setup(t, leaf, () => HttpResponse.json(wrap(leaf, expected)));
  for (const mode of modes) {
    const r = await invoke(cli, mode); assert.equal(r.exitCode, 0, r.stderr);
    if (mode !== "human") {
      assert.deepEqual(root(leaf, r.data), expected); assert.ok(Object.hasOwn(root(leaf, r.data).assetFields[0].options, "__proto__"));
    } else {
      assert.match(r.stdout, /Prototype label/); assert.match(r.stdout, /<b>Literal choice<\/b>/);
      assert.match(r.stdout, /<p>Literal help\\u000anext\\u001b/);
      assert.match(r.stdout, /line\\u000akey/); assert.doesNotMatch(r.stdout, /\u001b|\u009b|Group\tname/);
    }
  }
  assert.equal(({} as any).polluted, undefined);
});

for (const leaf of leaves) for (const scope of scopes) for (const key of ["description", "group", "groupHelpText"]) {
  test(`Q5 ${leaf} ${scope}.${key} has an exact decoded UTF8 byte budget`, async t => {
    let text = "é".repeat(8192);
    const cli = await setup(t, leaf, () => HttpResponse.json(wrap(leaf, { ...specification, [scope]: [{ ...selected, [key]: text }] })));
    for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 0); if (mode !== "human") assert.equal(root(leaf, r.data)[scope][0][key], text); }
    text += "x";
    for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 1); assert.equal(r.stdout, ""); if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed"); }
  });
}

for (const leaf of leaves) test(`Q5 ${leaf} all option entry key and label bounds are explicit failures`, async t => {
  let options: any = Object.fromEntries(Array.from({ length: 256 }, (_, i) => ["choice" + i, "Label " + i]));
  const cli = await setup(t, leaf, () => HttpResponse.json(wrap(leaf, { ...specification, componentFields: [{ ...selected, options }] })));
  for (const valid of [options, { ["é".repeat(128)]: "Label" }, { key: "é".repeat(8192) }]) {
    options = valid;
    for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 0); if (mode !== "human") assert.deepEqual(root(leaf, r.data).componentFields[0].options, options); }
  }
  for (const invalid of [Object.fromEntries(Array.from({ length: 257 }, (_, i) => ["choice" + i, "Label"])), { ["é".repeat(128) + "x"]: "Label" }, { key: "é".repeat(8192) + "x" }]) {
    options = invalid;
    for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 1); assert.equal(r.stdout, ""); if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed"); }
  }
});

for (const leaf of leaves) for (const scope of scopes) test(`Q5 ${leaf} malformed ${scope} metadata fails atomically without payloads`, async t => {
  let field: any = selected;
  const cli = await setup(t, leaf, () => HttpResponse.json(leaf === "list" ? [specification, { ...specification, [scope]: [selected, field] }] : { ...specification, [scope]: [selected, field] }));
  const invalid = [null, [], { ...selected, optional: "false" }, { ...selected, type: null },
    ...["description", "group", "groupHelpText"].flatMap(key => [1, true, [], { value: "SYNTHETIC_PRIVATE_BODY" }].map(value => ({ ...selected, [key]: value }))),
    ...[[], "SYNTHETIC_PRIVATE_BODY", 1, true, { choice: null }, { choice: 1 }, { choice: { secret: "SYNTHETIC_PRIVATE_BODY" } }].map(options => ({ ...selected, options }))];
  for (const value of invalid) {
    field = value;
    for (const mode of modes) for (const verbose of [false, true]) {
      const r = await invoke(cli, mode, verbose); assert.equal(r.exitCode, 1); assert.equal(r.stdout, "");
      assert.doesNotMatch(r.stderr, /SYNTHETIC_PRIVATE_BODY/); if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed");
    }
  }
});

for (const leaf of leaves) test(`Q5 ${leaf} retains root limits field order and honest empties`, async t => {
  let value: any = wrap(leaf, { ...specification, componentFields: [], assetFields: [] });
  let suffix = "";
  const cli = await setup(t, leaf, () => new HttpResponse(JSON.stringify(value) + suffix));
  for (const mode of modes) {
    const r = await invoke(cli, mode); assert.equal(r.exitCode, 0); if (mode !== "human") assert.deepEqual(root(leaf, r.data).assetFields, []);
  }
  value = wrap(leaf, specification); suffix = " ".repeat(4 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(value)));
  assert.equal((await invoke(cli, "json")).exitCode, 0); suffix += " ";
  assert.equal((await invoke(cli, "json")).error.code, "nexus.decodeFailed");
  suffix = "";
  if (leaf === "list") {
    value = Array(1000).fill(specification); assert.equal((await invoke(cli, "json")).data.length, 1000);
    value.push(specification); assert.equal((await invoke(cli, "json")).error.code, "nexus.decodeFailed");
    value = []; assert.match((await invoke(cli, "human")).stdout, /No upload specifications/);
  }
  value = wrap(leaf, { ...specification, componentFields: Array(64).fill(selected) });
  assert.equal(root(leaf, (await invoke(cli, "json")).data).componentFields.length, 64);
  value = wrap(leaf, { ...specification, assetFields: Array(65).fill(selected) });
  assert.equal((await invoke(cli, "json")).error.code, "nexus.decodeFailed");
});

for (const leaf of leaves) test(`Q5 ${leaf} unchanged HTTP admission cancellation and zero preflights`, async t => {
  let status = 404;
  const cli = await setup(t, leaf, () => new HttpResponse("SYNTHETIC_PRIVATE_BODY", { status }));
  for (const [s, code] of [[401, "http.unauthorized"], [403, "http.forbidden"], [404, "http.notFound"], [422, "http.rejected"], [500, "http.serverError"]] as const) {
    status = s;
    for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 1); assert.equal(r.stdout, ""); assert.doesNotMatch(r.stderr, /SYNTHETIC_PRIVATE_BODY/); if (mode !== "human") assert.equal(r.error.code, code); }
  }
  assert.equal(cli.requests.length, 15);
  await cli.fixture.run(cli.app, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
  for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 1); if (mode !== "human") assert.equal(r.error.code, "permission.denied"); }
  assert.equal(cli.requests.length, 15);
  await cli.fixture.run(cli.app, ["permissions", "grant", "ReadOnly", "--profile", "lab"]);
  let controller = new AbortController();
  cli.server.use(http.get(/.*/, () => { controller.abort(); return HttpResponse.json(wrap(leaf, specification)); }));
  for (const before of [true, false]) { controller = new AbortController(); if (before) controller.abort(); const r = await cli.fixture.run(cli.app, [...argv(leaf), "--json"], { signal: controller.signal }); assert.equal(r.exitCode, 130); assert.equal(r.stdout, ""); }
});

test("Q5 persistent RPC isolates Basic and anonymous metadata and encoded format names", async t => {
  const requests: Request[] = [];
  const server = setupServer(http.get(/.*/, ({ request }) => { requests.push(request); return HttpResponse.json(specification); }));
  server.listen({ onUnhandledRequest: "error" }); t.after(() => server.close());
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: ["alpha", "beta", "public", "denied"].map(name => ({ name,
    values: { url: `https://${name}.example.test/context`, authMode: name === "public" ? "anonymous" : "basic" }, permissions: name === "denied" ? [] : ["ReadOnly"],
    ...(name === "public" || name === "denied" ? {} : { secrets: { credentials: JSON.stringify({ username: name, password: "synthetic-" + name }) } }),
  })) });
  const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime }));
  const replies: any[] = await f.rpc(app, ["alpha", "beta", "public", "alpha"].map(name => ["formats", "upload-specs", "get", "a/b?雪%", "--profile", name]));
  assert.ok(replies.every(r => r.result?.assetFields[0].description === "Artifact extension"));
  assert.deepEqual(requests.map(r => r.url), ["alpha", "beta", "public", "alpha"].map(n => `https://${n}.example.test/context/service/rest/v1/formats/a%2Fb%3F%E9%9B%AA%25/upload-specs`));
  assert.deepEqual(requests.map(r => r.headers.get("authorization")), ["alpha", "beta", null, "alpha"].map(n => n === null ? null : "Basic " + Buffer.from(n + ":synthetic-" + n).toString("base64")));
  for (const name of [".", ".."]) assert.equal((await f.run(app, ["formats", "upload-specs", "get", name, "--profile", "alpha", "--json"])).exitCode, 2);
  const denied: any = (await f.rpc(app, [["formats", "upload-specs", "list", "--profile", "denied"]]))[0];
  assert.equal(denied.error.data.code, "permission.denied"); assert.equal(requests.length, 4);
});

for (const leaf of leaves) for (const phase of ["transport", "body"]) test(`Q5 ${leaf} ${phase} private native cause retains code and verbose frames`, async t => {
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: [{ name: "lab", values: { url: origin, authMode: "anonymous" }, permissions: ["ReadOnly"] }] });
  const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime: { ...runtime, fetch: async input => {
    const cause = Object.assign(new Error("synthetic metadata failure " + String(input) + "?token=SYNTHETIC_QUERY"), { code: "ECONNRESET" });
    cause.stack = `${cause.name}: ${cause.message}\n    at syntheticUploadMetadata (upload-metadata-native.js:17:3)`;
    const early = diagnosticCause(cause); if (phase === "transport") throw early;
    return new Response(new ReadableStream({ start(c) { c.error(early); } }));
  } } }));
  for (const mode of modes) for (const verbose of [false, true]) {
    const args = [...argv(leaf, "SYNTHETIC_PRIVATE_FORMAT?雪"), ...(verbose ? ["--verbose"] : [])];
    let output: string; let error: any;
    if (mode === "rpc") { const r: any = (await f.rpc(app, [args]))[0]; assert.equal(r.error.data.exitCode, 1); output = JSON.stringify(r); error = r.error.data; }
    else { const r = await f.run(app, args.concat(mode === "json" ? ["--json"] : [])); assert.equal(r.exitCode, 1); output = r.stdout + r.stderr; if (mode === "json") error = JSON.parse(r.stderr).error; }
    assert.doesNotMatch(output, /SYNTHETIC_PRIVATE_FORMAT|SYNTHETIC_QUERY|nexus\.example\.test/); assert.match(output, /synthetic metadata failure/);
    if (verbose) assert.match(output, /upload-metadata-native\.js:17:3/); else assert.doesNotMatch(output, /upload-metadata-native\.js/);
    if (mode !== "human") { const codes = []; for (let e = error; e; e = e.cause) codes.push(e.code); assert.ok(codes.includes("ECONNRESET")); }
  }
});
