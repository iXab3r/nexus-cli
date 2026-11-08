import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCli, diagnosticCause } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createDefinition } from "../src/cli.js";
import { offlineCli } from "./offline.js";

const origin = "https://nexus.example.test/context";
const paths = { components: "search", assets: "search/assets", download: "search/assets/download" };
type Leaf = keyof typeof paths;
const leaves = Object.keys(paths) as Leaf[];
const source = JSON.parse(readFileSync("docs/api/nexus-openapi.json", "utf8"));
const parameters = (leaf: Leaf): any[] => source.paths["/v1/" + paths[leaf]].get.parameters;
const controls = new Set(["continuationToken", "sort", "direction", "timeout"]);
const bytes = "synthetic server-selected bytes";
const digest = createHash("sha256").update(bytes).digest("hex");
const filter = (name: string, value: string) => ["--filter", JSON.stringify({ name, value })];
function response(leaf: Leaf, next: string | null = null): Response {
  if (leaf === "download") return new HttpResponse(bytes);
  const asset = '{"id":"asset","fileSize":9007199254740993}';
  const item = leaf === "assets" ? asset : '{"id":"component","assets":[' + asset + ']}';
  return new HttpResponse('{"items":[' + item + '],"continuationToken":' + JSON.stringify(next) + '}');
}
async function setup(t: TestContext, leaf: Leaf, respond: (url: URL) => Response = () => response(leaf)) {
  const requests: URL[] = [];
  const cli = await offlineCli(t, http.get("*", ({ request }) => {
    const url = new URL(request.url); requests.push(url); return respond(url);
  }));
  assert.equal((await cli.fixture.run(cli.app, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"])).exitCode, 0);
  return { ...cli, requests, leaf, sequence: 0 };
}
async function invoke(cli: Awaited<ReturnType<typeof setup>>, flags: string[], mode: "human" | "json" | "rpc") {
  const output = join(cli.fixture.root, `selected-${cli.sequence++}.bin`);
  const argv = ["search", cli.leaf, ...flags, ...(cli.leaf === "download" ? ["--output", output] : []), "--profile", "lab"];
  if (mode === "rpc") {
    const r: any = (await cli.fixture.rpc(cli.app, [argv]))[0];
    return { output, exitCode: r.error?.data.exitCode ?? 0, data: r.result ?? r.error?.data.result, error: r.error?.data,
      stdout: r.result === undefined ? "" : JSON.stringify(r.result), stderr: r.error ? JSON.stringify(r.error) : "" };
  }
  const r = await cli.fixture.run(cli.app, [...argv, ...(mode === "json" ? ["--json"] : [])]);
  return { ...r, output, data: mode === "json" && r.stdout ? JSON.parse(r.stdout) : undefined,
    error: mode === "json" && r.stderr ? JSON.parse(r.stderr).error : undefined };
}

for (const leaf of leaves) test(`Q3 ${leaf} independently routes every pinned parameter through JSON and RPC`, async t => {
  const cli = await setup(t, leaf);
  const params = parameters(leaf);
  assert.equal(params.length, leaf === "download" ? 79 : 80);
  for (const p of params) {
    const value = p.name === "timeout" ? "-2147483648" : p.schema.enum?.[0] ?? " native =/+%?&雪 ";
    const flags = controls.has(p.name) ? ["--" + (p.name === "continuationToken" ? "continuation-token" : p.name), value] : filter(p.name, value);
    for (const mode of ["json", "rpc"] as const) {
      const r = await invoke(cli, flags, mode);
      assert.equal(r.exitCode, 0, p.name + ":" + r.stderr);
      const request = cli.requests.at(-1)!;
      assert.equal(request.pathname, "/context/service/rest/v1/" + paths[leaf]);
      assert.deepEqual([...request.searchParams], [[p.name, value]]);
      if (leaf === "download") assert.equal(await readFile(r.data.path, "utf8"), bytes);
      else assert.equal((leaf === "assets" ? r.data.items[0] : r.data.items[0].assets[0]).fileSize, "9007199254740993");
    }
  }
  assert.equal(cli.requests.length, params.length * 2);
});

for (const leaf of leaves) test(`Q3 ${leaf} composes the full native string surface and dedicated controls`, async t => {
  const cli = await setup(t, leaf);
  const flags: string[] = [];
  const expected: Record<string, string> = {};
  for (const p of parameters(leaf)) {
    if (!controls.has(p.name)) { flags.push(...filter(p.name, " value:" + p.name + " ")); expected[p.name] = " value:" + p.name + " "; }
  }
  flags.push("--sort", "version", "--direction", "desc", "--timeout", "2147483647");
  Object.assign(expected, { sort: "version", direction: "desc", timeout: "2147483647" });
  if (leaf !== "download") { flags.push("--continuation-token", "opaque+/="); expected.continuationToken = "opaque+/="; }
  const r = await invoke(cli, flags, "json");
  assert.equal(r.exitCode, 0, r.stderr);
  assert.deepEqual(Object.fromEntries(cli.requests[0].searchParams), expected);
});

for (const leaf of leaves) test(`Q3 ${leaf} rejects malformed and conflicting query authorship before HTTP`, async t => {
  const cli = await setup(t, leaf);
  const invalid = [
    ["--filter", "{SYNTHETIC_PRIVATE_FILTER"], ["--filter", "null"], ["--filter", "[]"], ["--filter", "{}"],
    ["--filter", '{"name":"q","value":1}'], ["--filter", '{"name":1,"value":"x"}'],
    ["--filter", '{"name":"q","value":"x","extra":true}'], filter("unknown", "SYNTHETIC_PRIVATE_FILTER"),
    ...["sort", "direction", "timeout", "continuationToken"].map(key => filter(key, "x")),
    [...filter("q", "same"), ...filter("q", "same")], ["--q", "x", ...filter("q", "x")],
    ["--artifact-version", "1", ...filter("version", "1")], ["--prerelease", "true", ...filter("prerelease", "true")],
    ...["2147483648", "-2147483649", "+1", "1.5", "1e2", " 1", "NaN"].map(v => ["--timeout", v]),
  ];
  for (const argv of invalid) for (const mode of ["human", "json", "rpc"] as const) {
    const r = await invoke(cli, argv, mode);
    // Published Core helpers own syntax/int32 parser failures (exit 1); Nexus rules use 2.
    const expectedExit = argv[0] === "--timeout" || argv[1] === "{SYNTHETIC_PRIVATE_FILTER" ? 1 : 2;
    assert.equal(r.exitCode, expectedExit, JSON.stringify(argv) + r.stderr);
    if (mode !== "human") assert.equal(r.error.code, "usage");
    assert.equal(r.stdout, "");
    assert.doesNotMatch(r.stderr, /SYNTHETIC_PRIVATE_FILTER/);
  }
  assert.equal(cli.requests.length, 0);
});

for (const leaf of leaves) test(`Q3 ${leaf} preserves empty strings and native prerelease strings without a sort dependency`, async t => {
  const cli = await setup(t, leaf);
  for (const mode of ["human", "json", "rpc"] as const) {
    const r = await invoke(cli, [...filter("maven.classifier", ""), ...filter("prerelease", "native-value"), "--direction", "desc", "--timeout", "0"], mode);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.deepEqual(Object.fromEntries(cli.requests.at(-1)!.searchParams), { "maven.classifier": "", prerelease: "native-value", direction: "desc", timeout: "0" });
  }
});

for (const leaf of ["components", "assets"] as const) for (const fault of ["none", "denied", "bytes", "pages"]) {
  test(`Q3 ${leaf} paging retains native selectors and exact size on ${fault}`, async t => {
    const cli = await setup(t, leaf, url => {
      if (!url.searchParams.has("continuationToken")) return response(leaf, "opaque+/=");
      if (fault === "denied") return new HttpResponse("synthetic private response", { status: 403 });
      if (fault === "bytes") return new HttpResponse(" ".repeat(513));
      return response(leaf);
    });
    for (const mode of ["json", "rpc"] as const) {
      const r = await invoke(cli, [...filter("sha256", digest), ...filter("repositoryName", "releases"), "--timeout", "12", "--all",
        ...(fault === "pages" ? ["--max-pages", "1"] : []), ...(fault === "bytes" ? ["--max-page-bytes", "512"] : [])], mode);
      assert.equal(r.exitCode, fault === "none" ? 0 : 1);
      assert.equal((leaf === "assets" ? r.data.items[0] : r.data.items[0].assets[0]).fileSize, "9007199254740993");
      if (fault !== "none") assert.deepEqual(r.data.resume, { restart: false, token: "opaque+/=" });
    }
    for (const url of cli.requests) {
      assert.equal(url.searchParams.get("sha256"), digest);
      assert.equal(url.searchParams.get("repositoryName"), "releases");
      assert.equal(url.searchParams.get("timeout"), "12");
    }
  });
}

for (const leaf of leaves) test(`Q3 ${leaf} gate and safe remote failures preserve native selectors`, async t => {
  let status = 400;
  const cli = await setup(t, leaf, () => new HttpResponse("SYNTHETIC_PRIVATE_RESPONSE", { status }));
  for (const remote of [400, 401, 403, 404, 500]) {
    status = remote;
    for (const mode of ["human", "json", "rpc"] as const) {
      const r = await invoke(cli, filter("docker.contentDigest", "SYNTHETIC_PRIVATE_FILTER"), mode);
      assert.equal(r.exitCode, 1);
      assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_PRIVATE_FILTER|SYNTHETIC_PRIVATE_RESPONSE/);
    }
  }
  const before = cli.requests.length;
  assert.equal(before, 15);
  await cli.fixture.run(cli.app, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
  for (const mode of ["human", "json", "rpc"] as const) {
    const r = await invoke(cli, filter("sha256", digest), mode);
    assert.equal(r.exitCode, 1);
    if (mode !== "human") assert.equal(r.error.code, "permission.denied");
  }
  assert.equal(cli.requests.length, before);
});

for (const leaf of leaves) test(`Q3 ${leaf} body diagnostics redact standalone native filter values`, async t => {
  const marker = "SYNTHETIC_PRIVATE_FILTER";
  const cli = await setup(t, leaf, () => new HttpResponse(new ReadableStream({ start(c) {
    c.error(Object.assign(new Error("synthetic body failure " + marker), { code: "EFILTER_BODY" }));
  } })));
  for (const mode of ["human", "json", "rpc"] as const) {
    const r = await invoke(cli, filter("docker.contentDigest", marker), mode);
    assert.equal(r.exitCode, 1);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(marker));
    assert.match(r.stderr, /synthetic body failure/);
    if (mode !== "human") {
      const pending = [r.error];
      let found = false;
      while (pending.length) {
        const error = pending.pop();
        if (!error) continue;
        if (error.code === "EFILTER_BODY") found = true;
        if (error.cause) pending.push(error.cause);
      }
      assert.ok(found);
    }
  }
});

test("Q3 remote hash selection and local digest verification remain distinct", async t => {
  const cli = await setup(t, "download");
  for (const mode of ["human", "json", "rpc"] as const) {
    const r = await invoke(cli, [...filter("sha256", digest), "--sha256", digest], mode);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.equal(cli.requests.at(-1)!.searchParams.get("sha256"), digest);
    assert.equal(await readFile(r.output, "utf8"), bytes);
    if (mode !== "human") assert.equal(r.data.verified, true);
  }
  const failure = await invoke(cli, [...filter("sha256", digest), "--sha256", "0".repeat(64)], "json");
  assert.equal(failure.exitCode, 1);
  assert.equal(cli.requests.at(-1)!.searchParams.get("sha256"), digest);
  await assert.rejects(readFile(failure.output), { code: "ENOENT" });
});

test("Q3 persistent RPC keeps repeated filters and Basic scoped per invocation/profile", async t => {
  const seen: { host: string; query: string; auth: string | null }[] = [];
  const server = setupServer(http.get("*", ({ request }) => {
    const u = new URL(request.url); seen.push({ host: u.hostname, query: u.search, auth: request.headers.get("authorization") });
    return response("assets");
  })); server.listen({ onUnhandledRequest: "error" }); t.after(() => server.close());
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: ["alpha", "beta"].map(n => ({ name: n,
    values: { url: `https://${n}.example.test`, authMode: "basic" }, permissions: ["ReadOnly"],
    secrets: { credentials: JSON.stringify({ username: n, password: "synthetic-" + n }) },
  })) });
  const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime }));
  const replies: any[] = await f.rpc(app, [
    ["search", "assets", ...filter("repositoryName", "alpha-filter"), "--profile", "alpha"],
    ["search", "assets", ...filter("repositoryName", "beta-filter"), "--profile", "beta"],
    ["search", "assets", "--profile", "alpha"],
  ]);
  assert.ok(replies.every(r => r.result));
  assert.deepEqual(seen.map(r => r.query), ["?repositoryName=alpha-filter", "?repositoryName=beta-filter", ""]);
  assert.deepEqual(seen.map(r => r.auth), ["alpha", "beta", "alpha"].map(n => "Basic " + Buffer.from(n + ":synthetic-" + n).toString("base64")));
});

for (const leaf of leaves) test(`Q3 ${leaf} rejects every repeated dedicated wire flag before HTTP`, async t => {
  const cli = await setup(t, leaf);
  const scalar = ["repository", "name", "artifact-version", "group", "format", "q", "maven-base-version",
    ...(leaf === "components" ? [] : ["maven-extension", "maven-classifier"]),
    ...(leaf === "download" ? [] : ["continuation-token"])];
  const cases = [
    ...scalar.map(name => ["--" + name, "", "--" + name, "second"]),
    ["--sort", "group", "--sort", "name"], ["--direction", "asc", "--direction", "desc"],
    ["--prerelease", "false", "--prerelease", "true"], ["--timeout", "0", "--timeout", "1"],
  ];
  for (const flags of cases) for (const mode of ["human", "json", "rpc"] as const) {
    const r = await invoke(cli, flags, mode);
    assert.equal(r.exitCode, 2, flags[0] + r.stderr);
    assert.equal(r.stdout, "");
    if (mode !== "human") assert.equal(r.error.code, "usage");
  }
  assert.equal(cli.requests.length, 0);
  // Failed parsing must not contaminate the next command's previous option values.
  assert.equal((await invoke(cli, ["--q", "single"], "json")).exitCode, 0);
  assert.equal(cli.requests.length, 1);
});

for (const leaf of leaves) for (const phase of ["transport", "body"]) for (const spelling of ["form", "decoded"]) {
  test(`Q3 ${leaf} ${phase} ${spelling}-spelled selectors stay private in every diagnostic mode`, async t => {
    const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: [{ name: "lab",
      values: { url: origin, authMode: "anonymous" }, permissions: ["ReadOnly"],
    }] });
    const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime: { ...runtime, fetch: async input => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      // A transport may serialize query parameters without the enclosing URL, after an early copy.
      const form = url.searchParams.toString().replace(/%[A-F0-9]{2}/g, triplet => triplet.toLowerCase());
      const detail = spelling === "form" ? form : url.searchParams.get("docker.labels");
      const native = Object.assign(new Error("synthetic socket failed (" + detail + "); context"), { code: "ECONNRESET" });
      native.stack = `${native.name}: ${native.message}\n    at syntheticSelectorTransport (selector-native.js:17:3)`;
      const early = diagnosticCause(native);
      if (phase === "transport") throw early;
      return new Response(new ReadableStream({ start(c) { c.error(early); } }));
    } } }));
    const values = spelling === "form" ? ["SYNTHETIC PRIVATE SELECTOR", "SYNTHETIC PRIVATE +~!()雪"] : [
      "M9_PRIVATE_SELECTOR_PREFIX token=SYNTHETIC_VALUE",
      "M9_PRIVATE_SELECTOR_PREFIX api_key=SYNTHETIC_VALUE",
      "M9_PRIVATE_SELECTOR_PREFIX https://synthetic:private@host.example.test/p?token=SYNTHETIC_VALUE",
      "M9_PRIVATE_SELECTOR_PREFIX https://synthetic:private@host.example.test",
      "https://SYNTHETIC_PRIVATE_SELECTOR.example.test",
      "M9_PRIVATE_SELECTOR_PREFIX Basic SYNTHETIC_VALUE",
    ];
    for (const value of values) {
      for (const verbose of [false, true]) for (const mode of ["human", "json", "rpc"] as const) {
        const argv = ["search", leaf, ...filter("docker.labels", value), "--profile", "lab",
          ...(leaf === "download" ? ["--output", join(f.root, "form-error.bin")] : []), ...(verbose ? ["--verbose"] : [])];
        let text: string;
        let error: any;
        if (mode === "rpc") {
          const r: any = (await f.rpc(app, [argv]))[0];
          assert.equal(r.error.data.exitCode, 1); text = JSON.stringify(r); error = r.error.data;
        } else {
          const r = await f.run(app, [...argv, ...(mode === "json" ? ["--json"] : [])]);
          assert.equal(r.exitCode, 1); text = r.stdout + r.stderr;
          if (mode === "json") error = JSON.parse(r.stderr).error;
        }
        assert.doesNotMatch(text, /SYNTHETIC|PRIVATE|private|%e9%9b%aa/);
        assert.match(text, /synthetic socket failed/);
        if (verbose) assert.match(text, /selector-native\.js:17:3/);
        if (mode !== "human") {
          const codes = [];
          for (let e = error; e; e = e.cause) codes.push(e.code);
          assert.ok(codes.includes("ECONNRESET"));
        }
      }
    }
  });
}
