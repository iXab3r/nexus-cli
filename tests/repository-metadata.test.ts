import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCli, diagnosticCause } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createDefinition } from "../src/cli.js";
import { offlineCli } from "./offline.js";

const origin = "https://nexus.example.test/context";
const base = { name: "maven-proxy", format: "maven2", type: "proxy", url: origin + "/repository/maven-proxy", online: false };
const leaves = ["list", "get"] as const;
type Leaf = typeof leaves[number];
const modes = ["human", "json", "rpc"] as const;
const argv = (leaf: Leaf, name = "maven-proxy") => ["repositories", leaf, ...(leaf === "get" ? [name] : []), "--profile", "lab"];
const wire = (leaf: Leaf, record: string) => leaf === "list" ? "[" + record + "]" : record;
const record = (size: string) => JSON.stringify(base).slice(0, -1) + ',"size":' + size + '}';
const row = (value: any, leaf: Leaf) => leaf === "list" ? value[0] : value;
async function setup(t: TestContext, leaf: Leaf, respond: () => Response) {
  const requests: Request[] = [];
  const cli = await offlineCli(t, http.get("*", ({ request }) => { requests.push(request); return respond(); }));
  assert.equal((await cli.fixture.run(cli.app, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"])).exitCode, 0);
  return { ...cli, requests, leaf };
}
async function invoke(cli: Awaited<ReturnType<typeof setup>>, mode: typeof modes[number], extra: string[] = []) {
  if (mode === "rpc") {
    const r: any = (await cli.fixture.rpc(cli.app, [[...argv(cli.leaf), ...extra]]))[0];
    return { exitCode: r.error?.data.exitCode ?? 0, data: r.result, error: r.error?.data,
      stdout: r.result === undefined ? "" : JSON.stringify(r.result), stderr: r.error ? JSON.stringify(r.error) : "" };
  }
  const r = await cli.fixture.run(cli.app, [...argv(cli.leaf), ...extra, ...(mode === "json" ? ["--json"] : [])]);
  return { ...r, data: mode === "json" && r.stdout ? JSON.parse(r.stdout) : undefined,
    error: mode === "json" && r.stderr ? JSON.parse(r.stderr).error : undefined };
}

for (const leaf of leaves) for (const [token, expected] of [
  ["0", 0], ["9007199254740991", Number.MAX_SAFE_INTEGER], ["-9007199254740991", -Number.MAX_SAFE_INTEGER],
  ["9007199254740993", "9007199254740993"], ["-9007199254740993", "-9007199254740993"],
  ["9223372036854775807", "9223372036854775807"], ["-9223372036854775808", "-9223372036854775808"],
] as const) test(`Q4 ${leaf} exact repository size ${token} in every mode`, async t => {
  const cli = await setup(t, leaf, () => new HttpResponse(wire(leaf, record(token))));
  for (const mode of modes) {
    const r = await invoke(cli, mode); assert.equal(r.exitCode, 0, r.stderr);
    if (mode === "human") { assert.match(r.stdout, /Reported size \(B\)/); assert.ok(r.stdout.includes(String(expected))); }
    else assert.deepEqual(row(r.data, leaf), { ...base, size: expected });
  }
  assert.equal(cli.requests.length, 3);
  for (const request of cli.requests) {
    assert.equal(request.url, origin + "/service/rest/v1/repositories" + (leaf === "get" ? "/maven-proxy" : ""));
    assert.equal(request.method, "GET"); assert.equal(request.headers.get("authorization"), null);
    assert.equal(request.headers.get("accept"), "application/json"); assert.equal(await request.text(), "");
  }
});

for (const leaf of leaves) test(`Q4 ${leaf} native numeric spellings and optional size remain distinct`, async t => {
  let body = JSON.stringify(base);
  const cli = await setup(t, leaf, () => new HttpResponse(wire(leaf, body)));
  for (const [token, expected] of [[undefined, undefined], ["-0", 0], ["0e99999999999999999", 0], ["1.5e1", 15],
    ["1000e-3", 1], ["9.007199254740993e15", "9007199254740993"], ["92233720368547758070e-1", "9223372036854775807"]] as const) {
    body = token === undefined ? JSON.stringify(base) : record(token);
    for (const mode of modes) {
      const r = await invoke(cli, mode); assert.equal(r.exitCode, 0);
      if (mode === "human") {
        assert.ok(r.stdout.includes(expected === undefined ? "not reported" : String(expected)));
        assert.doesNotMatch(r.stdout, /empty repository|measured size/i);
      } else { assert.equal(row(r.data, leaf).size, expected); assert.equal(Object.hasOwn(row(r.data, leaf), "size"), token !== undefined); }
    }
  }
});

for (const leaf of leaves) test(`Q4 ${leaf} rejects invalid sizes without any result`, async t => {
  let token = "null";
  const cli = await setup(t, leaf, () => new HttpResponse(wire(leaf, record(token))));
  for (const value of ["null", '"9007199254740993"', "true", "{}", "[]", "1.25", "9007199254740991.000000000000001",
    "9223372036854775808", "-9223372036854775809", "1e99999999999999999", "1e-99999999999999999", "00", "NaN"]) {
    token = value;
    for (const mode of modes) {
      const r = await invoke(cli, mode); assert.equal(r.exitCode, 1, value); assert.equal(r.stdout, "");
      if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed");
    }
  }
});

for (const leaf of leaves) test(`Q4 ${leaf} projects only source-known attributes and credential-free URLs`, async t => {
  let value: any = base;
  const cli = await setup(t, leaf, () => new HttpResponse(wire(leaf, JSON.stringify(value))));
  for (const [attributes, expected] of [
    [undefined, undefined], [{}, {}], [{ proxy: {} }, { proxy: {} }],
    [{ proxy: { remoteUrl: "" } }, { proxy: { remoteUrl: "" } }],
    [{ proxy: { remoteUrl: null } }, { proxy: { remoteUrl: null } }],
    [{ proxy: { remoteUrl: "https://upstream.example.test/maven2" } }, { proxy: { remoteUrl: "https://upstream.example.test/maven2" } }],
    [{ proxy: { remoteUrl: "https://SYNTHETIC_USER:SYNTHETIC_PASSWORD@upstream.example.test/maven2?token=SYNTHETIC_QUERY#SYNTHETIC_FRAGMENT",
      password: "SYNTHETIC_ATTRIBUTE" }, secretGroup: { secret: "SYNTHETIC_GROUP" } }, { proxy: { remoteUrl: "https://upstream.example.test/maven2" } }],
    [{ proxy: { remoteUrl: "not a URL SYNTHETIC_INVALID" } }, { proxy: { remoteUrl: null } }],
    [{ proxy: { remoteUrl: "file:///SYNTHETIC_PATH" } }, { proxy: { remoteUrl: null } }],
  ] as const) {
    value = { ...base, ...(attributes === undefined ? {} : { attributes }), url: origin + "/repository/maven-proxy?token=SYNTHETIC_URL#SYNTHETIC_HASH", future: "SYNTHETIC_FUTURE" };
    for (const mode of modes) {
      const r = await invoke(cli, mode); assert.equal(r.exitCode, 0, r.stderr);
      assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC|secretGroup|password/);
      if (mode !== "human") {
        assert.deepEqual(row(r.data, leaf), { ...base, ...(expected === undefined ? {} : { attributes: expected }) });
      } else {
        assert.match(r.stdout, /Upstream URL/);
        const upstream = expected?.proxy?.remoteUrl;
        assert.ok(r.stdout.includes(upstream === undefined ? "not reported" : upstream === null ? "not displayable" : upstream === "" ? "(empty)" : upstream));
      }
    }
  }
  value = { ...base, type: "hosted", attributes: { proxy: { remoteUrl: "SYNTHETIC_IGNORED" } } };
  const result = await invoke(cli, "json"); assert.deepEqual(row(result.data, leaf).attributes, {});
});

for (const leaf of leaves) test(`Q4 ${leaf} repository URL is an explicit safe projection`, async t => {
  let url = "https://SYNTHETIC_USER:SYNTHETIC_PASSWORD@nexus.example.test/context/repository/maven-proxy?token=SYNTHETIC_QUERY#SYNTHETIC_HASH";
  const cli = await setup(t, leaf, () => HttpResponse.json(leaf === "list" ? [{ ...base, url }] : { ...base, url }));
  for (const input of [url, "not a URL SYNTHETIC_VALUE", "ftp://upstream.example.test/SYNTHETIC_PATH", ""]) {
    url = input;
    for (const mode of modes) {
      const r = await invoke(cli, mode); assert.equal(r.exitCode, 0); assert.doesNotMatch(r.stdout, /SYNTHETIC/);
      if (mode !== "human") assert.equal(row(r.data, leaf).url, input.startsWith("https:") ? base.url : null);
    }
  }
});

for (const leaf of leaves) test(`Q4 ${leaf} invalid shapes fail atomically and privately`, async t => {
  let value: any = base;
  const cli = await setup(t, leaf, () => HttpResponse.json(leaf === "list" ? [base, value] : value));
  for (const bad of [null, [], { ...base, url: null }, { ...base, online: null }, { ...base, name: null },
    ...[null, [], "SYNTHETIC_SHAPE", { proxy: null }, { proxy: [] }, { secretGroup: "SYNTHETIC_SHAPE" },
      { proxy: { remoteUrl: 7 } }, { proxy: { remoteUrl: {} } }, { proxy: { remoteUrl: [] } }].map(attributes => ({ ...base, attributes }))]) {
    value = bad;
    for (const mode of modes) for (const verbose of [false, true]) {
      const r = await invoke(cli, mode, verbose ? ["--verbose"] : []);
      assert.equal(r.exitCode, 1); assert.equal(r.stdout, ""); assert.doesNotMatch(r.stderr, /SYNTHETIC_SHAPE/);
      if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed");
    }
  }
});

for (const leaf of leaves) test(`Q4 ${leaf} human escapes controls without changing admitted machine strings`, async t => {
  const value = { ...base, name: "demo\u001b[31m", format: "maven2\nnext", type: "proxy\tfield", online: true, size: 15 };
  const cli = await setup(t, leaf, () => HttpResponse.json(leaf === "list" ? [value] : value));
  for (const mode of ["json", "rpc"] as const) assert.deepEqual(row((await invoke(cli, mode)).data, leaf), value);
  const human = await invoke(cli, "human"); assert.equal(human.exitCode, 0); assert.doesNotMatch(human.stdout, /\u001b|maven2\nnext|proxy\tfield/);
  assert.match(human.stdout, /\\u001b/); assert.match(human.stdout, /maven2\\u000anext/);
});

for (const leaf of leaves) test(`Q4 ${leaf} exact keys ignore deep unrelated values and honor final duplicate keys`, async t => {
  let text = JSON.stringify(base).slice(0, -1) + ',"attributes":{"extra":{"size":1.25,"deep":' + '['.repeat(3000) + '0' + ']'.repeat(3000) + '}},"s\\u0069ze":9007199254740993}';
  const cli = await setup(t, leaf, () => new HttpResponse(wire(leaf, text)));
  for (const mode of modes) {
    const r = await invoke(cli, mode); assert.equal(r.exitCode, 0);
    if (mode !== "human") assert.deepEqual(row(r.data, leaf), { ...base, size: "9007199254740993", attributes: {} });
  }
  for (const tail of [',"size":1.25,"size":9007199254740993', ',"size":{"size":7},"size":9007199254740993']) {
    text = JSON.stringify(base).slice(0, -1) + tail + '}';
    assert.equal(row((await invoke(cli, "json")).data, leaf).size, "9007199254740993");
  }
  text = JSON.stringify(base).slice(0, -1) + ',"size":9007199254740993,"size":null}';
  assert.equal((await invoke(cli, "json")).exitCode, 1);
});

for (const leaf of leaves) test(`Q4 ${leaf} retains HTTP codes, ReadOnly admission and no retry`, async t => {
  let status = 401;
  const cli = await setup(t, leaf, () => new HttpResponse("SYNTHETIC_PRIVATE_RESPONSE", { status }));
  for (const [s, code] of [[401, "http.unauthorized"], [403, "http.forbidden"], [404, "http.notFound"], [422, "http.rejected"], [500, "http.serverError"]] as const) {
    status = s;
    for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 1); assert.equal(r.stdout, "");
      assert.doesNotMatch(r.stderr, /SYNTHETIC_PRIVATE_RESPONSE/); if (mode !== "human") assert.equal(r.error.code, code); }
  }
  assert.equal(cli.requests.length, 15);
  await cli.fixture.run(cli.app, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
  for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 1); if (mode !== "human") assert.equal(r.error.code, "permission.denied"); }
  assert.equal(cli.requests.length, 15);
});

for (const leaf of leaves) test(`Q4 ${leaf} exact response budget and complete list admission`, async t => {
  let text = wire(leaf, JSON.stringify(base));
  const cli = await setup(t, leaf, () => new HttpResponse(text));
  text += " ".repeat(4 * 1024 * 1024 - Buffer.byteLength(text));
  assert.equal((await invoke(cli, "json")).exitCode, 0);
  text += " ";
  for (const mode of modes) { const r = await invoke(cli, mode); assert.equal(r.exitCode, 1); assert.equal(r.stdout, ""); if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed"); }
  if (leaf === "list") {
    text = JSON.stringify(Array(1000).fill(base)); assert.equal((await invoke(cli, "json")).data.length, 1000);
    text = JSON.stringify(Array(1001).fill(base)); assert.equal((await invoke(cli, "json")).exitCode, 1);
    text = "[]"; assert.match((await invoke(cli, "human")).stdout, /No visible repositories/);
  }
});

for (const leaf of leaves) test(`Q4 ${leaf} cancellation stops acquisition without a partial result`, async t => {
  let controller = new AbortController();
  const cli = await setup(t, leaf, () => { controller.abort(); return new HttpResponse(wire(leaf, JSON.stringify(base))); });
  for (const before of [true, false]) {
    controller = new AbortController(); if (before) controller.abort();
    const r = await cli.fixture.run(cli.app, [...argv(leaf), "--json"], { signal: controller.signal });
    assert.notEqual(r.exitCode, 0); assert.equal(r.stdout, ""); assert.doesNotMatch(r.stderr, /mutationUnknown|published/);
  }
  assert.equal(cli.requests.length, 1);
});

for (const leaf of leaves) test(`Q4 ${leaf} denied Basic profile does not require absent credentials`, async t => {
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: [{ name: "lab", values: { url: origin, authMode: "basic" }, permissions: [] }] });
  let calls = 0;
  const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime: { ...runtime, fetch: async () => { calls++; throw new Error("No HTTP expected"); } } }));
  for (const mode of ["json", "rpc"]) {
    if (mode === "json") { const r = await f.run(app, [...argv(leaf), "--json"]); assert.equal(JSON.parse(r.stderr).error.code, "permission.denied"); }
    else { const r: any = (await f.rpc(app, [argv(leaf)]))[0]; assert.equal(r.error.data.code, "permission.denied"); }
  }
  assert.equal(calls, 0);
});

test("Q4 RPC Basic and anonymous profiles do not cross endpoints or metadata", async t => {
  const seen: { url: string; auth: string | null }[] = [];
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: ["alpha", "beta", "public"].map(name => ({ name,
    values: { url: `https://${name}.example.test/context`, authMode: name === "public" ? "anonymous" : "basic" }, permissions: ["ReadOnly"],
    ...(name === "public" ? {} : { secrets: { credentials: JSON.stringify({ username: name, password: "synthetic-" + name }) } }),
  })) });
  const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime }));
  const server = setupServer(http.get("*", ({ request }) => {
    seen.push({ url: request.url, auth: request.headers.get("authorization") });
    return new HttpResponse(record("9007199254740993"));
  })); server.listen({ onUnhandledRequest: "error" }); t.after(() => server.close());
  const replies: any[] = await f.rpc(app, ["alpha", "beta", "public", "alpha"].map(name => ["repositories", "get", "a/b?雪%", "--profile", name]));
  assert.ok(replies.every(r => r.result?.size === "9007199254740993"));
  assert.deepEqual(seen.map(r => r.auth), ["alpha", "beta", null, "alpha"].map(n => n === null ? null : "Basic " + Buffer.from(n + ":synthetic-" + n).toString("base64")));
  assert.deepEqual(seen.map(r => r.url), ["alpha", "beta", "public", "alpha"].map(n => `https://${n}.example.test/context/service/rest/v1/repositories/a%2Fb%3F%E9%9B%AA%25`));
  const before = seen.length;
  for (const name of [".", ".."]) { const r = await f.run(app, ["repositories", "get", name, "--profile", "alpha", "--json"]); assert.equal(r.exitCode, 2); }
  assert.equal(seen.length, before);
});

for (const leaf of leaves) for (const phase of ["transport", "body"]) test(`Q4 ${leaf} ${phase} private native cause retains code and frames`, async t => {
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: [{ name: "lab", values: { url: origin, authMode: "anonymous" }, permissions: ["ReadOnly"] }] });
  const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime: { ...runtime, fetch: async input => {
    const url = String(input); const cause = Object.assign(new Error("synthetic socket failure " + url), { code: "ECONNRESET" });
    cause.stack = `${cause.name}: ${cause.message}\n    at syntheticRepositoryTransport (repository-native.js:17:3)`;
    const early = diagnosticCause(cause); if (phase === "transport") throw early;
    return new Response(new ReadableStream({ start(c) { c.error(early); } }));
  } } }));
  for (const mode of modes) for (const verbose of [false, true]) {
    const args = argv(leaf, "SYNTHETIC_PRIVATE_NAME?雪").concat(verbose ? ["--verbose"] : []);
    let output: string; let error: any;
    if (mode === "rpc") { const r: any = (await f.rpc(app, [args]))[0]; assert.equal(r.error.data.exitCode, 1); output = JSON.stringify(r); error = r.error.data; }
    else { const r = await f.run(app, args.concat(mode === "json" ? ["--json"] : [])); assert.equal(r.exitCode, 1); output = r.stdout + r.stderr; if (mode === "json") error = JSON.parse(r.stderr).error; }
    assert.doesNotMatch(output, /SYNTHETIC_PRIVATE_NAME|nexus\.example\.test/); assert.match(output, /synthetic socket failure/);
    if (verbose) assert.match(output, /repository-native\.js:17:3/); else assert.doesNotMatch(output, /repository-native\.js/);
    if (mode !== "human") { const codes = []; for (let e = error; e; e = e.cause) codes.push(e.code); assert.ok(codes.includes("ECONNRESET")); }
  }
});
