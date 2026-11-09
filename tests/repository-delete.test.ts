import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";
const base = "https://nexus.example.test/service/rest/v1/";
const row = (name = "owned", type = "hosted") => ({ name, type, format: "maven2", url: "https://nexus.example.test/repository/" + name, online: false, attributes: {} });
async function configure(f: any, app: any, update = true) {
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  if (update) await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
}
for (const mode of ["human", "json", "rpc"]) test(`#677 exact repository delete preflight and204 ${mode}`, async t => {
  const calls: string[] = [];
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "repositories/owned", () => { calls.push("GET owned"); return HttpResponse.json(row()); }),
    http.delete(base + "repositories/owned", () => { calls.push("DELETE owned"); return new HttpResponse(null, { status: 204 }); }));
  await configure(f, app);
  const argv = ["repositories", "delete", "owned", "--confirm-name", "owned", "--profile", "lab"];
  if (mode === "rpc") { const r: any = await f.rpc(app, [argv]); assert.deepEqual(r[0].result, { name: "owned", acknowledged: true }); }
  else { const r = await f.run(app, [...argv, ...(mode === "json" ? ["--json"] : [])]); assert.equal(r.exitCode, 0, r.stderr); if (mode === "json") assert.deepEqual(JSON.parse(r.stdout), { name: "owned", acknowledged: true }); }
  assert.deepEqual(calls, ["GET owned", "DELETE owned"]);
});
for (const reason of ["gate", "missing-confirmation", "wrong-confirmation", "invalid-name", "wrong-identity", "missing", "forbidden", "invalid-shape"]) test(`#677 repository delete refuses ${reason} before mutation`, async t => {
  let reads = 0, writes = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "repositories/owned", () => { reads++; return reason === "missing" || reason === "forbidden" ? new HttpResponse(null, { status: reason === "missing" ? 404 : 403 }) : HttpResponse.json(reason === "invalid-shape" ? { name: "owned" } : row(reason === "wrong-identity" ? "other" : "owned")); }),
    http.delete(base + "repositories/owned", () => { writes++; return new HttpResponse(null, { status: 204 }); }));
  await configure(f, app, reason !== "gate");
  const name = reason === "invalid-name" ? ".." : "owned";
  const result = await f.run(app, ["repositories", "delete", name, ...(reason === "missing-confirmation" ? [] : ["--confirm-name", reason === "wrong-confirmation" ? "other" : name]), "--profile", "lab", "--json"]);
  assert.notEqual(result.exitCode, 0); assert.equal(result.stdout, ""); assert.equal(writes, 0);
  assert.equal(reads, ["gate", "missing-confirmation", "wrong-confirmation", "invalid-name"].includes(reason) ? 0 : 1);
});
for (const status of [200, 202, 401, 403, 404, 500, "transport"] as const) test(`#677 repository delete ${status} requires reconciliation and never retries`, async t => {
  let reads = 0, writes = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "repositories/owned", () => { reads++; return HttpResponse.json(row()); }),
    http.delete(base + "repositories/owned", () => { writes++; return status === "transport" ? HttpResponse.error() : new HttpResponse(null, { status }); }));
  await configure(f, app);
  const result = await f.run(app, ["repositories", "delete", "owned", "--confirm-name", "owned", "--profile", "lab", "--json"]);
  assert.equal(result.exitCode, 1); assert.equal(result.stdout, ""); assert.equal(reads, 1); assert.equal(writes, 1);
  const code = JSON.parse(result.stderr).error.code;
  if (status === "transport") { assert.equal(code, "nexus.mutation.outcomeUnknown"); assert.match(result.stderr, /[Rr]econcile/); }
  else if (status < 300) { assert.equal(code, "nexus.mutation.acknowledgementUnknown"); assert.match(result.stderr, /[Rr]econcile/); }
  else assert.match(result.stderr, /Partial changes may exist/);
});
for (const list of [false, true]) test(`#677 generic ${list ? "catalog" : "GET"} group members use native settings whitelist/order`, async t => {
  const group = row("owned-group", "group");
  const settings = { name: "owned-group", format: "maven2", type: "group", group: { memberNames: ["second", "first"], writableMember: "SYNTHETIC_PRIVATE" }, secret: "SYNTHETIC_PRIVATE" };
  let settingsCalls = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "repositories" + (list ? "" : "/owned-group"), () => HttpResponse.json(list ? [group, row("other")] : group)),
    http.get(base + "repositorySettings", () => { settingsCalls++; return HttpResponse.json([settings, { name: "other", password: "SYNTHETIC_PRIVATE" }]); }));
  await configure(f, app, false);
  const argv = ["repositories", ...(list ? ["list"] : ["get", "owned-group"]), "--include-group-members", "--profile", "lab"];
  const projected = { ...group, attributes: { group: { memberNames: ["second", "first"] } } };
  const expected = list ? [projected, row("other")] : projected;
  assert.equal((await f.run(app, argv)).exitCode, 0);
  assert.deepEqual(await f.json(app, argv), expected);
  const rpc: any = await f.rpc(app, [argv]); assert.deepEqual(rpc[0].result, expected);
  assert.equal(settingsCalls, 3); assert.doesNotMatch(JSON.stringify(rpc), /SYNTHETIC_PRIVATE|password|writableMember/);
});
for (const problem of ["missing", "duplicate", "wrong-format", "wrong-type", "invalid-member", "absent-members", "denied"]) test(`#677 group refs fail closed on ${problem}`, async t => {
  const native: any = { name: "owned-group", format: "maven2", type: problem === "wrong-type" ? "proxy" : "group", group: { memberNames: [problem === "invalid-member" ? "bad/name" : "owned"] } };
  if (problem === "absent-members") delete native.group.memberNames;
  if (problem === "wrong-format") native.format = "npm";
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "repositories/owned-group", () => HttpResponse.json(row("owned-group", "group"))),
    http.get(base + "repositorySettings", () => problem === "denied" ? new HttpResponse("SYNTHETIC_PRIVATE", { status: 403 }) : HttpResponse.json(problem === "missing" ? [] : problem === "duplicate" ? [native, native] : [native])));
  await configure(f, app, false);
  const r = await f.run(app, ["repositories", "get", "owned-group", "--include-group-members", "--profile", "lab", "--json", "--verbose"]);
  assert.equal(r.exitCode, 1); assert.equal(r.stdout, ""); assert.doesNotMatch(r.stderr, /SYNTHETIC_PRIVATE|bad\/name/);
});
test("#677 synthetic group-first cleanup preserves untargeted repositories and blob store", async t => {
  const names = ["legacy-group", "legacy-release", "legacy-snapshot", "legacy-proxy"];
  const state = new Map([...names, "untargeted"].map((n, i) => [n, row(n, i === 0 ? "group" : i === 3 ? "proxy" : "hosted")]));
  let blobWrites = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "repositories/:name", ({ params }) => state.has(String(params.name)) ? HttpResponse.json(state.get(String(params.name))) : new HttpResponse(null, { status: 404 })),
    http.delete(base + "repositories/:name", ({ params }) => { assert.ok(names.includes(String(params.name))); assert.equal(state.delete(String(params.name)), true); return new HttpResponse(null, { status: 204 }); }),
    http.all(base + "blobstores/*", () => { blobWrites++; throw Error("No blob store operation belongs to repository deletion"); }));
  await configure(f, app);
  for (const name of names) { const result = await f.run(app, ["repositories", "delete", name, "--confirm-name", name, "--profile", "lab", "--json"]); assert.equal(result.exitCode, 0, result.stderr); }
  assert.deepEqual([...state.keys()], ["untargeted"]); assert.equal(blobWrites, 0);
});
