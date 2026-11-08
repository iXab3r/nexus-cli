import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { createCli, diagnosticCause } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { setupServer } from "msw/node";
import { createDefinition } from "../src/cli.js";
import { offlineCli } from "./offline.js";

const origin = "https://nexus.example.test:443/context";
const base = "https://nexus.example.test/context/service/rest/v1/";
const name = "opaque+/=";
const path = "blobstores/opaque%2B%2F%3D/quota-status";
const marker = "SYNTHETIC_PRIVATE_DETAIL";
const modes = ["human", "json", "rpc"] as const;
async function setup(t: TestContext, respond: (request: Request) => Response) {
  const requests: Request[] = [];
  const cli = await offlineCli(t, http.all("*", ({ request }) => {
    requests.push(request);
    return respond(request);
  }));
  assert.equal((await cli.fixture.run(cli.app, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"])).exitCode, 0);
  return { ...cli, requests };
}
async function invoke(cli: Awaited<ReturnType<typeof setup>>, mode: typeof modes[number], selector = name) {
  const argv = ["blobstores", "quota-status", selector, "--profile", "lab"];
  if (mode === "rpc") {
    const r: any = (await cli.fixture.rpc(cli.app, [argv]))[0];
    return { exitCode: r.error?.data.exitCode ?? 0, stdout: r.result === undefined ? "" : JSON.stringify(r.result),
      stderr: r.error ? JSON.stringify(r.error) : "", data: r.result ?? r.error?.data.result, error: r.error?.data };
  }
  const r = await cli.fixture.run(cli.app, [...argv, ...(mode === "json" ? ["--json"] : [])]);
  return { ...r, data: mode === "json" && r.stdout ? JSON.parse(r.stdout) : undefined,
    error: mode === "json" && r.stderr ? JSON.parse(r.stderr).error : undefined };
}

for (const violation of [false, true]) test(`Q1 quota outcome ${violation} has one exact GET and truthful channels`, async t => {
  const expected = { blobStoreName: "canonical-store", isViolation: violation, message: violation ? "Quota exceeded" : "Quota available" };
  const cli = await setup(t, () => HttpResponse.json({ ...expected, future: marker }));
  for (const mode of modes) {
    const r = await invoke(cli, mode);
    assert.equal(r.exitCode, violation ? 1 : 0, r.stderr);
    if (mode !== "human") assert.deepEqual(r.data, expected);
    else { assert.match(r.stdout, /canonical-store/); assert.match(r.stdout, /Quota (exceeded|available)/); }
    if (violation && mode !== "human") assert.equal(r.error.code, "nexus.blobstore.quotaViolation");
    if (!violation) assert.equal(r.stderr, "");
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(marker));
  }
  assert.equal(cli.requests.length, 3);
  for (const request of cli.requests) {
    assert.equal(request.method, "GET");
    assert.equal(request.url, base + path);
    assert.equal(request.headers.get("accept"), "application/json");
    assert.equal(request.headers.get("authorization"), null);
    assert.equal(await request.text(), "");
  }
});

test("Q1 no quota preserves the source DTO without inventing configured or health facts", async t => {
  const expected = { blobStoreName: "store", isViolation: false, message: "Blob store store has no quota" };
  const cli = await setup(t, () => HttpResponse.json(expected));
  for (const mode of modes) {
    const r = await invoke(cli, mode);
    assert.equal(r.exitCode, 0, r.stderr);
    if (mode !== "human") assert.deepEqual(r.data, expected);
    assert.doesNotMatch(r.stdout, /quotaConfigured|healthy|writable/);
  }
});

test("Q1 ReadOnly denial is zero HTTP in every transport", async t => {
  const cli = await setup(t, () => { throw new Error("HTTP must not be reached"); });
  await cli.fixture.run(cli.app, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
  for (const mode of modes) {
    const r = await invoke(cli, mode);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    if (mode !== "human") assert.equal(r.error.code, "permission.denied");
  }
  assert.equal(cli.requests.length, 0);
});

for (const status of [400, 401, 403, 404, 500]) test(`Q1 remote ${status} is a safe one-request failure`, async t => {
  const cli = await setup(t, () => new HttpResponse(marker, { status }));
  for (const mode of modes) {
    const r = await invoke(cli, mode);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    if (mode !== "human") assert.equal(r.error.code, ({ 400: "http.rejected", 401: "http.unauthorized", 403: "http.forbidden", 404: "http.notFound", 500: "http.serverError" })[status]);
    assert.doesNotMatch(r.stderr, new RegExp(marker + "|outcomeUnknown"));
  }
  assert.equal(cli.requests.length, 3);
});

for (const value of [null, [], {}, { blobStoreName: "x", isViolation: false },
  { blobStoreName: "x", isViolation: "false", message: "x" }, { blobStoreName: 1, isViolation: false, message: "x" },
  { blobStoreName: "x", isViolation: false, message: 1 }, { blobStoreName: "", isViolation: false, message: "x" },
  { blobStoreName: "x", isViolation: false, message: "" }]) {
  test(`Q1 rejects malformed quota DTO ${JSON.stringify(value)}`, async t => {
    const cli = await setup(t, () => HttpResponse.json(value));
    for (const mode of modes) {
      const r = await invoke(cli, mode);
      assert.equal(r.exitCode, 1);
      assert.equal(r.stdout, "");
      if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed");
    }
  });
}

for (const fault of ["json", "utf8", "bytes", "length", "stream"] as const) test(`Q1 rejects ${fault} without a quota result`, async t => {
  const cli = await setup(t, () => {
    if (fault === "json") return new HttpResponse("{" + marker);
    if (fault === "utf8") return new HttpResponse(new Uint8Array([0xff]));
    if (fault === "bytes") return new HttpResponse(" ".repeat(4194305));
    if (fault === "length") return new HttpResponse("{}", { headers: { "content-length": "999" } });
    return new HttpResponse(new ReadableStream({ start(c) { c.error(new Error("synthetic stream failure")); } }));
  });
  for (const mode of modes) {
    const r = await invoke(cli, mode);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    assert.doesNotMatch(r.stderr, new RegExp(marker));
    if (mode !== "human") assert.equal(r.error.code, "nexus.decodeFailed");
  }
});

test("Q1 human data escapes terminal controls while JSON/RPC preserve service strings", async t => {
  const expected = { blobStoreName: "store\u001b[31m", isViolation: false, message: "message\u009b0m\nnext" };
  const cli = await setup(t, () => HttpResponse.json(expected));
  for (const mode of modes) {
    const r = await invoke(cli, mode);
    assert.equal(r.exitCode, 0, r.stderr);
    if (mode !== "human") assert.deepEqual(r.data, expected);
    else {
      assert.doesNotMatch(r.stdout, /[\u001b\u009b]/);
      assert.match(r.stdout, /\\u001b/);
    }
  }
});

for (const id of [".", ".."]) test(`Q1 navigation-only name ${id} fails before HTTP`, async t => {
  const cli = await setup(t, () => HttpResponse.json({}));
  for (const mode of modes) assert.equal((await invoke(cli, mode, id)).exitCode, 2);
  assert.equal(cli.requests.length, 0);
});

test("Q1 cancellation before and during acquisition has no mutation-unknown result", async t => {
  let controller = new AbortController();
  const cli = await setup(t, () => { controller.abort(); return HttpResponse.json({}); });
  for (const before of [true, false]) {
    controller = new AbortController();
    if (before) controller.abort();
    const r = await cli.fixture.run(cli.app, ["blobstores", "quota-status", name, "--profile", "lab", "--json"], { signal: controller.signal });
    assert.equal(r.exitCode, 130);
    assert.equal(r.stdout, "");
    assert.doesNotMatch(r.stderr, /outcomeUnknown/);
  }
  assert.equal(cli.requests.length, 1);
});

for (const phase of ["transport", "body"]) test(`Q1 nested ${phase} causes redact opaque names and retain native evidence`, async t => {
  const selector = "SYNTHETIC_PRIVATE_STORE";
  const cli = await setup(t, () => {
    const cause = diagnosticCause(Object.assign(new Error(selector), { code: "EQUOTA_SYNTHETIC" }));
    if (phase === "transport") throw cause;
    return new HttpResponse(new ReadableStream({ start(c) { c.error(cause); } }));
  });
  const r = await cli.fixture.run(cli.app, ["blobstores", "quota-status", selector, "--profile", "lab", "--json", "--verbose"]);
  assert.equal(r.exitCode, 1);
  assert.equal(r.stdout, "");
  assert.doesNotMatch(r.stderr, new RegExp(selector));
  // MSW serializes resolver throws as an HTTP500; stream errors retain the native chain.
  if (phase === "body") assert.match(r.stderr, /EQUOTA_SYNTHETIC/);
});

test("Q1 persistent RPC isolates Basic profiles and redirect credentials", async t => {
  const requests: { url: string; auth: string | null }[] = [];
  const server = setupServer(http.all("*", ({ request }) => {
    requests.push({ url: request.url, auth: request.headers.get("authorization") });
    if (new URL(request.url).hostname === "alpha.example.test") return new HttpResponse(null, { status: 302, headers: { location: "https://external.example.test/quota" } });
    return HttpResponse.json({ blobStoreName: "store", isViolation: false, message: "Quota available" });
  }));
  server.listen({ onUnhandledRequest: "error" }); t.after(() => server.close());
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: ["alpha", "beta"].map(n => ({
    name: n, values: { url: `https://${n}.example.test:443/context`, authMode: "basic" }, permissions: ["ReadOnly"],
    secrets: { credentials: JSON.stringify({ username: n, password: "synthetic-" + n }) },
  })) });
  const a = f.createApplication(runtime => createCli({ ...createDefinition(), runtime }));
  const replies: any[] = await f.rpc(a, ["alpha", "beta", "alpha"].map(n => ["blobstores", "quota-status", "store", "--profile", n]));
  assert.ok(replies.every(r => r.result?.isViolation === false));
  assert.deepEqual(requests.map(r => r.auth), ["Basic " + Buffer.from("alpha:synthetic-alpha").toString("base64"), null,
    "Basic " + Buffer.from("beta:synthetic-beta").toString("base64"), "Basic " + Buffer.from("alpha:synthetic-alpha").toString("base64"), null]);
  assert.equal(requests[0].url, "https://alpha.example.test/context/service/rest/v1/blobstores/store/quota-status");
});
