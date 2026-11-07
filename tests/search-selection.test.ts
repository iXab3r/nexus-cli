import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";

const origin = "https://nexus.example.test/context";
const routes = { components: "search", assets: "search/assets", download: "search/assets/download" };
const selection = ["--repository", "snapshots", "--name", "widget", "--group", "com.example",
  "--format", "maven2", "--q", "widget query", "--artifact-version", "1.2-20261107.123456-4",
  "--maven-base-version", "1.2-SNAPSHOT", "--sort", "version", "--direction", "desc", "--prerelease", "false"];
const expected = { repository: "snapshots", name: "widget", group: "com.example", format: "maven2",
  q: "widget query", version: "1.2-20261107.123456-4", "maven.baseVersion": "1.2-SNAPSHOT",
  sort: "version", direction: "desc", prerelease: "false" };
const observed = { id: "server-choice", name: "widget", version: "1.2-20261107.123456-4", path: "widget-server-choice.jar" };
const bytes = "server selected snapshot bytes";
const sha256 = createHash("sha256").update(bytes).digest("hex");

async function setup(t: TestContext, respond: (url: URL) => Response) {
  const dir = await mkdtemp(join(await realpath(tmpdir()), "nexus-selection-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const requests: URL[] = [];
  const cli = await offlineCli(t, http.get("*", ({ request }) => {
    const url = new URL(request.url);
    requests.push(url);
    return respond(url);
  }));
  const configured = await cli.fixture.run(cli.app, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"]);
  assert.equal(configured.exitCode, 0, configured.stderr);
  return { ...cli, dir, requests };
}

test("S29 pinned schema exposes selection fields separately on all three endpoints", () => {
  const source = readFileSync("docs/api/nexus-openapi.json");
  assert.equal(createHash("sha256").update(source).digest("hex"), "2d5261f26dd225103e886c0cb2becfa710b690a19e308a504cdd57a9293407ca");
  const schema = JSON.parse(source.toString());
  for (const route of Object.values(routes)) {
    const parameters = Object.fromEntries(schema.paths["/v1/" + route].get.parameters.map((p: any) => [p.name, p.schema]));
    assert.deepEqual(parameters.sort, { type: "string", enum: ["group", "name", "version", "repository"] });
    assert.deepEqual(parameters.direction, { type: "string", enum: ["asc", "desc"] });
    for (const key of ["maven.baseVersion", "prerelease"]) assert.deepEqual(parameters[key], { type: "string" });
  }
});

for (const kind of ["components", "assets"] as const) for (const mode of ["human", "json", "rpc"]) {
  test(`S29 ${kind} listing selection and observed version through ${mode}`, async t => {
    const { fixture: f, app: a, requests, dir } = await setup(t, () => HttpResponse.json({ items: [observed], continuationToken: null }));
    const argv = ["search", kind, ...selection, ...(kind === "assets" ? ["--maven-extension", "jar", "--maven-classifier", ""] : []), "--profile", "lab"];
    let result: any;
    if (mode === "rpc") result = ((await f.rpc(a, [argv], { cwd: dir })) as any[])[0].result;
    else {
      const r = await f.run(a, [...argv, ...(mode === "json" ? ["--json"] : [])], { cwd: dir });
      assert.equal(r.exitCode, 0, r.stderr);
      assert.equal(r.stderr, "");
      if (mode === "human") { assert.match(r.stdout, /server-choice/); assert.match(r.stdout, /1\.2-20261107\.123456-4/); }
      else result = JSON.parse(r.stdout);
    }
    if (mode !== "human") assert.deepEqual(result, { items: [observed], pagesFetched: 1, complete: true, continuationToken: null, resume: null, reason: null });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].pathname, "/context/service/rest/v1/" + routes[kind]);
    assert.deepEqual(Object.fromEntries(requests[0].searchParams), { ...expected, ...(kind === "assets" ? { "maven.extension": "jar", "maven.classifier": "" } : {}) });
  });
}

for (const mode of ["human", "json", "rpc"]) test(`S29 deliberate server download selection through ${mode}`, async t => {
  const { fixture: f, app: a, dir, requests } = await setup(t, url => url.pathname.endsWith("/search/assets/download")
    ? new HttpResponse(null, { status: 302, headers: { location: "/context/repository/snapshots/widget-server-choice.jar" } })
    : new HttpResponse(bytes));
  const argv = ["search", "download", ...selection, "--maven-extension", "jar", "--maven-classifier", "", "--sha256", sha256, "--profile", "lab"];
  let result: any;
  if (mode === "rpc") result = ((await f.rpc(a, [argv], { cwd: dir })) as any[])[0].result;
  else {
    const r = await f.run(a, [...argv, ...(mode === "json" ? ["--json"] : [])], { cwd: dir });
    assert.equal(r.exitCode, 0, r.stderr);
    assert.equal(r.stderr, "");
    if (mode === "human") assert.match(r.stdout, /widget-server-choice\.jar/);
    else result = JSON.parse(r.stdout);
  }
  if (mode !== "human") {
    assert.equal(basename(result.path), "widget-server-choice.jar");
    assert.equal(result.bytes, Buffer.byteLength(bytes));
    assert.equal(result.sha256, sha256);
    assert.equal(result.verified, true);
    assert.equal("version" in result, false);
  }
  assert.equal(await readFile(join(dir, "widget-server-choice.jar"), "utf8"), bytes);
  assert.equal(requests.length, 2); // Exactly the selection request and the server's redirect, no metadata/ranking request.
  assert.deepEqual(Object.fromEntries(requests[0].searchParams), { ...expected, "maven.extension": "jar", "maven.classifier": "" });
  assert.equal(requests[1].pathname, "/context/repository/snapshots/widget-server-choice.jar");
});

for (const kind of Object.keys(routes) as (keyof typeof routes)[]) {
  for (const sort of ["group", "name", "version", "repository"]) test(`S29 ${kind} accepts server sort ${sort}`, async t => {
    const { fixture: f, app: a, requests, dir } = await setup(t, () => kind === "download" ? new HttpResponse(bytes) : HttpResponse.json({ items: [], continuationToken: null }));
    const r = await f.run(a, ["search", kind, "--sort", sort, "--direction", "asc", "--prerelease", "true", "--profile", "lab", "--json"], { cwd: dir });
    assert.equal(r.exitCode, 0, r.stderr);
    assert.equal(requests.length, 1);
    assert.deepEqual(Object.fromEntries(requests[0].searchParams), { sort, direction: "asc", prerelease: "true" });
  });

  for (const invalid of [["--direction", "desc"], ["--sort", "latest"], ["--sort", "Version"], ["--sort", "version", "--direction", "down"], ["--prerelease", "TRUE"], ["--prerelease", "1"], ["--prerelease", ""], ["--sort"], ["--direction"], ["--prerelease"], ["--maven-base-version"]]) {
    test(`S29 ${kind} rejects ${JSON.stringify(invalid)} before HTTP in CLI and RPC`, async t => {
      const { fixture: f, app: a, dir, requests } = await setup(t, () => new HttpResponse(bytes));
      const argv = ["search", kind, "--profile", "lab", ...invalid];
      const expectedExit = invalid.length === 1 ? 1 : 2; // Pinned Core owns missing-value parser errors.
      for (const mode of ["human", "json"]) {
        const r = await f.run(a, [...argv, ...(mode === "json" ? ["--json"] : [])], { cwd: dir });
        assert.equal(r.exitCode, expectedExit, r.stderr);
        assert.equal(r.stdout, "");
        if (mode === "json") assert.equal(JSON.parse(r.stderr).error.code, "usage");
        else assert.ok(r.stderr.trim().split("\n").length <= 3, r.stderr);
      }
      const replies = await f.rpc(a, [argv], { cwd: dir }) as any[];
      assert.equal(replies[0].error.data.exitCode, expectedExit);
      assert.equal(replies[0].error.data.code, "usage");
      assert.equal(requests.length, 0);
      assert.deepEqual(await readdir(dir), []);
    });
  }

  test(`S29 ${kind} preserves omitted selection filters and explicit version`, async t => {
    const { fixture: f, app: a, requests, dir } = await setup(t, () => kind === "download" ? new HttpResponse(bytes) : HttpResponse.json({ items: [], continuationToken: null }));
    const r = await f.run(a, ["search", kind, "--artifact-version", "1.0", "--profile", "lab", "--json"], { cwd: dir });
    assert.equal(r.exitCode, 0, r.stderr);
    assert.equal(requests.length, 1);
    assert.deepEqual(Object.fromEntries(requests[0].searchParams), { version: "1.0" });
  });

  for (const status of [401, 403, 404, 400]) test(`S29 ${kind} safe remote ${status} with selection`, async t => {
    const marker = "synthetic-response-private-marker";
    const { fixture: f, app: a, requests, dir } = await setup(t, () => new HttpResponse(marker, { status }));
    const argv = ["search", kind, ...selection, "--profile", "lab"];
    for (const mode of ["human", "json", "rpc"]) {
      if (mode === "rpc") {
        const replies = await f.rpc(a, [argv], { cwd: dir }) as any[];
        assert.equal(replies[0].error.data.exitCode, 1);
        assert.doesNotMatch(JSON.stringify(replies), new RegExp(marker));
      } else {
        const r = await f.run(a, [...argv, ...(mode === "json" ? ["--json"] : [])], { cwd: dir });
        assert.equal(r.exitCode, 1);
        assert.doesNotMatch(r.stdout + r.stderr, new RegExp(marker));
        if (kind === "download") assert.equal(r.stdout, "");
        else if (mode === "json") assert.deepEqual(JSON.parse(r.stdout).resume, { restart: true, token: null });
      }
    }
    assert.equal(requests.length, 3);
    assert.deepEqual(await readdir(dir), []);
  });

  test(`S29 ${kind} ReadOnly denial is zero HTTP`, async t => {
    const { fixture: f, app: a, requests, dir } = await setup(t, () => new HttpResponse(bytes));
    await f.run(a, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
    const argv = ["search", kind, ...selection, "--profile", "lab"];
    assert.equal((await f.run(a, argv, { cwd: dir })).exitCode, 1);
    const denied = await f.run(a, [...argv, "--json"], { cwd: dir });
    assert.equal(denied.exitCode, 1);
    assert.equal(JSON.parse(denied.stderr).error.code, "permission.denied");
    assert.equal(((await f.rpc(a, [argv], { cwd: dir })) as any[])[0].error.data.code, "permission.denied");
    assert.equal(requests.length, 0);
    assert.deepEqual(await readdir(dir), []);
  });
}

test("S29 unordered download retains server ambiguity and creates no file", async t => {
  const { fixture: f, app: a, requests, dir } = await setup(t, () => new HttpResponse("synthetic ambiguity", { status: 400 }));
  for (const classifier of [undefined, ""]) {
    const argv = ["search", "download", "--name", "widget", ...(classifier === undefined ? [] : ["--maven-classifier", classifier]), "--profile", "lab"];
    assert.equal((await f.run(a, [...argv, "--json"], { cwd: dir })).exitCode, 1);
    assert.deepEqual(Object.fromEntries(requests.at(-1)!.searchParams), { name: "widget", ...(classifier === undefined ? {} : { "maven.classifier": "" }) });
  }
  assert.equal(requests.length, 2);
  assert.deepEqual(await readdir(dir), []);
});

for (const kind of ["components", "assets"] as const) for (const fault of ["none", "denied", "items", "bytes", "malformed", "pages"]) {
  test(`S29 ${kind} paging retains selection and checkpoint on ${fault}`, async t => {
    const token = "opaque+/= token";
    const { fixture: f, app: a, requests, dir } = await setup(t, url => {
      if (!url.searchParams.has("continuationToken")) return HttpResponse.json({ items: [observed], continuationToken: token });
      if (fault === "denied") return new HttpResponse(null, { status: 403 });
      if (fault === "malformed") return new HttpResponse("{");
      if (fault === "bytes") return new HttpResponse("x".repeat(4097));
      return HttpResponse.json({ items: fault === "items" ? [{ id: "second" }, { id: "third" }] : [{ id: "second" }], continuationToken: null });
    });
    const filters = [...selection, ...(kind === "assets" ? ["--maven-classifier", ""] : [])];
    const argv = ["search", kind, ...filters, "--all", "--max-pages", fault === "pages" ? "1" : "2", "--max-page-items", "1", "--max-page-bytes", "4096", "--profile", "lab", "--json"];
    const r = await f.run(a, argv, { cwd: dir });
    assert.equal(r.exitCode, fault === "none" ? 0 : 1, r.stderr);
    const result = JSON.parse(r.stdout);
    assert.deepEqual(result.items, fault === "none" ? [observed, { id: "second" }] : [observed]);
    assert.equal(result.complete, fault === "none");
    assert.deepEqual(result.resume, fault === "none" ? null : { restart: false, token });
    if (fault !== "none") {
      assert.equal(result.reason, ({ denied: "fetchFailed", items: "itemBudget", bytes: "byteBudget", malformed: "decodeFailed", pages: "pageBudget" } as Record<string, string>)[fault]);
      // An explicit resume must retain the same filters and send the opaque token unchanged.
      await f.run(a, ["search", kind, ...filters, "--continuation-token", result.resume.token, "--profile", "lab", "--json"], { cwd: dir });
    }
    assert.equal(requests.length, fault === "none" || fault === "pages" ? 2 : 3);
    for (const [index, url] of requests.entries()) assert.deepEqual(Object.fromEntries(url.searchParams), {
      ...expected, ...(kind === "assets" ? { "maven.classifier": "" } : {}), ...(index > 0 ? { continuationToken: token } : {}),
    });
  });
}
