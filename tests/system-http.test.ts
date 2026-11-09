import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";
const base = "https://nexus.example.test/context/service/rest/v1/";
const sensitive = "SYNTHETIC_HTTP_SECRET";
const authInfo = { enabled: true, username: sensitive, password: sensitive, ntlmHost: sensitive, ntlmDomain: sensitive };
const settings = () => ({ userAgent: sensitive, timeout: 60, retries: 2, nonProxyHosts: ["localhost", "*.example.test"],
  httpProxy: { enabled: true, host: "proxy.example.test", port: "3128", authInfo },
  httpsProxy: { enabled: false, host: "", port: "", authInfo: { ...authInfo, enabled: false } } });
const expected = { userAgentConfigured: true, timeout: 60, retries: 2, nonProxyHosts: ["localhost", "*.example.test"],
  httpProxy: { enabled: true, host: "proxy.example.test", port: "3128", authInfo: { enabled: true } },
  httpsProxy: { enabled: false, host: "", port: "", authInfo: { enabled: false } } };
async function configure(f: any, app: any, basic = false) {
  const pair = JSON.stringify({ username: "synthetic-admin", password: sensitive });
  const r = await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test/context",
    ...(basic ? ["--credentials-stdin"] : ["--auth-mode", "anonymous"])], { input: Readable.from([pair]) });
  assert.equal(r.exitCode, 0, r.stderr);
}
for (const basic of [false, true]) test(`#677 system HTTP safe projection with ${basic ? "Basic" : "anonymous"} profile in all modes`, async t => {
  let calls = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "repositories", () => HttpResponse.json([])),
    http.get(base + "http", ({ request }) => {
      calls++; assert.equal(request.method, "GET");
      assert.equal(request.headers.get("authorization"), basic ? "Basic " + Buffer.from("synthetic-admin:" + sensitive).toString("base64") : null);
      return HttpResponse.json(settings());
    }));
  await configure(f, app, basic);
  const argv = ["system", "http", "get", "--profile", "lab"];
  const human = await f.run(app, argv); assert.equal(human.exitCode, 0, human.stderr);
  const json = await f.run(app, [...argv, "--json"]); assert.equal(json.exitCode, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), expected);
  const rpc: any = await f.rpc(app, [argv]); assert.deepEqual(rpc[0].result, expected);
  assert.equal(calls, 3);
  assert.doesNotMatch(human.stdout + human.stderr + json.stdout + json.stderr + JSON.stringify(rpc), /SYNTHETIC_HTTP_SECRET|\*\*\*\*/);
});
for (const status of [204, 401, 403, 404, 502]) test(`#677 system HTTP status ${status} is not a settings observation`, async t => {
  let calls = 0;
  const { fixture: f, app } = await offlineCli(t, http.get(base + "http", () => { calls++; return new HttpResponse(status === 204 ? null : sensitive, { status }); }));
  await configure(f, app);
  const result = await f.run(app, ["system", "http", "get", "--profile", "lab", "--json", "--verbose"]);
  assert.equal(result.exitCode, 1); assert.equal(calls, 1); assert.equal(result.stdout, "");
  assert.equal(JSON.parse(result.stderr).error.code, status === 401 ? "http.unauthorized" : status === 403 ? "http.forbidden" : "http.rejected");
  assert.doesNotMatch(result.stderr, /SYNTHETIC_HTTP_SECRET/);
});
for (const kind of ["malformed", "oversize", "invalid-utf8", "type", "missing", "unknown"]) test(`#677 system HTTP bounded static decode failure ${kind}`, async t => {
  let value: any = settings();
  if (kind === "type") value.timeout = sensitive;
  if (kind === "missing") delete value.httpsProxy;
  if (kind === "unknown") value.privateToken = sensitive;
  const body = kind === "malformed" ? '{"password":"' + sensitive : kind === "oversize" ? " ".repeat(65537) : kind === "invalid-utf8" ? new Uint8Array([255]) : JSON.stringify(value);
  const { fixture: f, app } = await offlineCli(t, http.get(base + "http", () => new HttpResponse(body)));
  await configure(f, app);
  const argv = ["system", "http", "get", "--profile", "lab", "--verbose"];
  const json = await f.run(app, [...argv, "--json"]);
  assert.equal(json.exitCode, 1); assert.equal(json.stdout, ""); assert.equal(JSON.parse(json.stderr).error.code, "nexus.decodeFailed");
  const rpc: any = await f.rpc(app, [argv]); assert.match(JSON.stringify(rpc), /nexus.decodeFailed/);
  assert.doesNotMatch(json.stderr + JSON.stringify(rpc), /SYNTHETIC_HTTP_SECRET/);
});
test("#677 system HTTP ReadOnly gate and no service mutation/input surface", async t => {
  let calls = 0;
  const { fixture: f, app } = await offlineCli(t, http.all(base + "http", () => { calls++; return HttpResponse.json(settings()); }));
  await configure(f, app);
  await f.run(app, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
  const denied = await f.run(app, ["system", "http", "get", "--profile", "lab", "--json"]);
  assert.equal(JSON.parse(denied.stderr).error.code, "permission.denied"); assert.equal(calls, 0);
  for (const args of [["update"], ["reset"], ["delete"], ["get", "--input-stdin"]]) {
    const result = await f.run(app, ["system", "http", ...args, "--profile", "lab", "--json"]);
    assert.equal(result.exitCode, 2); assert.equal(calls, 0);
  }
});
test("#677 system HTTP nullable defaults and credential-bearing host fields are withheld", async t => {
  const value = settings(); value.userAgent = ""; value.httpProxy.host = "https://synthetic:" + sensitive + "@proxy.example.test/?token=" + sensitive;
  value.httpProxy.port = sensitive; value.nonProxyHosts = ["localhost", "https://synthetic:" + sensitive + "@proxy.example.test"];
  const { fixture: f, app } = await offlineCli(t, http.get(base + "http", () => HttpResponse.json(value)));
  await configure(f, app);
  const result: any = await f.json(app, ["system", "http", "get", "--profile", "lab"]);
  assert.equal(result.userAgentConfigured, false); assert.equal(result.httpProxy.host, null); assert.equal(result.httpProxy.port, null);
  assert.deepEqual(result.nonProxyHosts, ["localhost", null]); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_HTTP_SECRET/);
});
