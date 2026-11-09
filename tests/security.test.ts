import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";
const base = "https://nexus.example.test/service/rest/v1/";
const role = { id: "owned", name: "Owned reader", roles: ["inherited"], privileges: ["custom-name"] };
const user = { userId: "owned", firstName: "Synthetic", lastName: "Reader", emailAddress: "reader@example.test", source: "default", status: "active", roles: ["owned"] };
const selector = { name: "owned", type: "csel", description: "Selected packages", expression: 'format == "npm" and path =^ "/selected/"' };
const viewPrivilege = { name: "owned", description: "Owned privilege", actions: ["READ", "BROWSE"], format: "npm", repository: "shared" };
for (const [argv, path, value] of [
  [["anonymous", "get"], "security/anonymous", { enabled: false, userId: "anonymous", realmName: "NexusAuthorizingRealm" }],
  [["realms", "active"], "security/realms/active", ["NexusAuthenticatingRealm", "NexusAuthorizingRealm"]],
  [["realms", "available"], "security/realms/available", [{ id: "NexusAuthorizingRealm", name: "Local" }]],
  [["users", "list", "--user-id", "owned"], "security/users", [user]],
  [["roles", "list"], "security/roles", [role]],
  [["roles", "get", "owned"], "security/roles/owned", role],
  [["privileges", "list"], "security/privileges", [{ type: "wildcard", name: "custom-name", pattern: "nexus:repository-view:npm:shared:read" }, { ...viewPrivilege, name: "nx-repository-view-*-*-read", type: "repository-view" }]],
  [["privileges", "get", "owned"], "security/privileges/owned", { ...viewPrivilege, type: "repository-view" }],
  [["content-selectors", "list"], "security/content-selectors", [selector]],
  [["content-selectors", "get", "owned"], "security/content-selectors/owned", selector],
] as const) test(`#677 security observation ${argv.join(" ")}`, async t => {
  const { fixture: f, app } = await offlineCli(t, http.get(base + path, ({ request }) => {
    if (argv[0] === "users") assert.equal(new URL(request.url).searchParams.get("userId"), "owned");
    return HttpResponse.json(value);
  }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const result = await f.json(app, ["security", ...argv, "--profile", "lab"]);
  assert.deepEqual(result, value);
  const rpc: any = await f.rpc(app, [["security", ...argv, "--profile", "lab"]]);
  assert.deepEqual(rpc[0].result, value);
});
for (const [argv, path, method, input, status] of [
  [["anonymous", "set"], "security/anonymous", "put", { enabled: true, userId: "anonymous", realmName: "NexusAuthorizingRealm" }, 200],
  [["realms", "set-active"], "security/realms/active", "put", ["NexusAuthorizingRealm", "NuGetApiKey"], 204],
  [["roles", "create"], "security/roles", "post", role, 200],
  [["roles", "update", "owned"], "security/roles/owned", "put", role, 204],
  [["users", "create"], "security/users", "post", { userId: user.userId, firstName: user.firstName, lastName: user.lastName, emailAddress: user.emailAddress, status: user.status, roles: user.roles, password: "SYNTHETIC_USER_PASSWORD" }, 200],
  [["users", "update", "owned"], "security/users/owned", "put", user, 204],
  [["content-selectors", "create"], "security/content-selectors", "post", { name: selector.name, description: selector.description, expression: selector.expression }, 204],
  [["content-selectors", "update", "owned"], "security/content-selectors/owned", "put", { description: selector.description, expression: selector.expression }, 204],
  [["privileges", "repository-view", "create"], "security/privileges/repository-view", "post", viewPrivilege, 201],
  [["privileges", "repository-view", "update", "owned"], "security/privileges/repository-view/owned", "put", viewPrivilege, 204],
  [["privileges", "repository-content-selector", "create"], "security/privileges/repository-content-selector", "post", { ...viewPrivilege, contentSelector: "owned" }, 201],
  [["privileges", "repository-content-selector", "update", "owned"], "security/privileges/repository-content-selector/owned", "put", { ...viewPrivilege, contentSelector: "owned" }, 204],
] as const) test(`#677 security mutation ${argv.join(" ")}`, async t => {
  let writes = 0;
  const { fixture: f, app } = await offlineCli(t, http[method](base + path, async ({ request }) => {
    writes++; assert.deepEqual(await request.json(), input);
    return new HttpResponse(null, { status });
  }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const file = join(f.root, "body.json"); await writeFile(file, JSON.stringify(input), { mode: 0o600 });
  const call = ["security", ...argv, "--input-file", file, "--profile", "lab"];
  const denied = await f.run(app, [...call, "--json"]);
  assert.equal(JSON.parse(denied.stderr).error.code, "permission.denied"); assert.equal(writes, 0);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const rpc: any = await f.rpc(app, [call]);
  assert.equal(rpc[0].result?.acknowledged, true, JSON.stringify(rpc)); assert.equal(writes, 1);
  assert.doesNotMatch(JSON.stringify(rpc), /SYNTHETIC_USER_PASSWORD/);
});
for (const kind of ["users", "roles", "privileges", "content-selectors"]) test(`#677 delete exact ${kind}`, async t => {
  let writes = 0;
  const { fixture: f, app } = await offlineCli(t, http.delete(base + "security/" + kind + "/owned", () => { writes++; return new HttpResponse(null, { status: 204 }); }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const argv = ["security", kind, "delete", "owned", "--profile", "lab", "--json"];
  const wrong = await f.run(app, [...argv, "--confirm-id", "other"]); assert.notEqual(wrong.exitCode, 0); assert.equal(writes, 0);
  assert.equal((await f.run(app, [...argv, "--confirm-id", "owned"])).exitCode, 0); assert.equal(writes, 1);
});
for (const state of ["active", "disabled", "absent", "unsupported", "denied", "multiple"]) test(`#677 actual Default Role ${state}`, async t => {
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "capabilities/types", () => HttpResponse.json(state === "unsupported" ? [] : [{ id: "defaultrole", name: "Default Role" }])),
    http.get(base + "capabilities", () => state === "denied" ? new HttpResponse(null, { status: 403 }) : HttpResponse.json(state === "absent" || state === "unsupported" ? [] : Array.from({ length: state === "multiple" ? 2 : 1 }, (_, i) => ({ id: "cap" + i, type: "defaultrole", enabled: state === "active", active: state === "active", properties: { role: "owned" } })))),
    http.get(base + "security/realms/active", () => HttpResponse.json(["DefaultRole", "NexusAuthorizingRealm"])));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const r = await f.run(app, ["security", "default-role", "get", "--profile", "lab", "--json"]);
  if (state === "denied" || state === "multiple") assert.notEqual(r.exitCode, 0);
  else { assert.equal(r.exitCode, 0, r.stderr); assert.equal(JSON.parse(r.stdout).state, state); }
});

test("#677 Default Role setter preserves other capabilities and source identity", async t => {
  const current = { id: "actual-cap", type: "defaultrole", enabled: true, active: true, notes: "Existing note", properties: { role: "old" } };
  let writes = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "capabilities/types", () => HttpResponse.json([{ id: "defaultrole" }])),
    http.get(base + "capabilities", () => HttpResponse.json([{ id: "unrelated", type: "other", properties: { untouched: "yes" } }, current])),
    http.get(base + "security/realms/active", () => HttpResponse.json(["NexusAuthorizingRealm", "DefaultRole"])),
    http.put(base + "capabilities/actual-cap", async ({ request }) => { writes++; assert.deepEqual(await request.json(), { ...current, enabled: false, properties: { role: "new" } }); return new HttpResponse(null, { status: 204 }); }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const file = join(f.root, "role.json"); await writeFile(file, JSON.stringify({ enabled: false, role: "new" }));
  const argv = ["security", "default-role", "set", "--input-file", file, "--profile", "lab"];
  assert.equal((await f.run(app, [...argv, "--json"])).exitCode, 1); assert.equal(writes, 0);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const r: any = await f.rpc(app, [argv]); assert.equal(r[0].result?.acknowledged, true, JSON.stringify(r)); assert.equal(writes, 1);
});

test("#677 password replacement uses protected input and native text body", async t => {
  let calls = 0;
  const { fixture: f, app } = await offlineCli(t, http.put(base + "security/users/owned/change-password", async ({ request }) => {
    calls++; assert.equal(request.headers.get("content-type"), "text/plain"); assert.equal(await request.text(), 'SYNTHETIC_"PASSWORD'); return new HttpResponse(null, { status: 204 });
  }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "password.json"); await writeFile(file, JSON.stringify({ password: 'SYNTHETIC_"PASSWORD' }), { mode: 0o600 });
  const r: any = await f.rpc(app, [["security", "users", "change-password", "owned", "--credentials-file", file, "--profile", "lab"]]);
  assert.equal(r[0].result?.acknowledged, true, JSON.stringify(r)); assert.equal(calls, 1); assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_/);
});

// Actual 3.97 resource return types, independent of generated Swagger defaults:
// realms and capability update return void (204); anonymous/capability create return DTO (200).
for (const kind of ["realms", "default-update", "default-create", "anonymous"] as const)
for (const status of [200, 201, 202, 204, 401, 403]) test(`#677 source status ${kind} HTTP ${status} across output modes`, async t => {
  const expected = kind === "realms" || kind === "default-update" ? 204 : 200;
  const existing = { id: "owned-cap", type: "defaultrole", enabled: true, active: true, properties: { role: "old" } };
  const input = kind === "realms" ? ["NexusAuthorizingRealm", "NuGetApiKey"] : kind === "anonymous"
    ? { enabled: false, userId: "anonymous", realmName: "NexusAuthorizingRealm" } : { enabled: false, role: "owned" };
  const path = kind === "realms" ? "security/realms/active" : kind === "anonymous" ? "security/anonymous" : "capabilities" + (kind === "default-update" ? "/owned-cap" : "");
  let writes = 0;
  const handler = async ({ request }: { request: Request }) => {
    writes++;
    assert.deepEqual(await request.json(), kind === "default-update" ? { ...existing, enabled: false, properties: { role: "owned" } }
      : kind === "default-create" ? { type: "defaultrole", enabled: false, properties: { role: "owned" } } : input);
    return new HttpResponse(null, { status });
  };
  const { fixture: f, app } = await offlineCli(t,
    http.get(base + "capabilities/types", () => HttpResponse.json([{ id: "defaultrole" }])),
    http.get(base + "capabilities", () => HttpResponse.json(kind === "default-create" ? [] : [existing])),
    http.get(base + "security/realms/active", () => HttpResponse.json(["NexusAuthorizingRealm"])),
    (kind === "default-create" ? http.post : http.put)(base + path, handler));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "status-body.json"); await writeFile(file, JSON.stringify(input), { mode: 0o600 });
  const call = ["security", ...(kind === "realms" ? ["realms", "set-active"] : kind === "anonymous" ? ["anonymous", "set"] : ["default-role", "set"]), "--input-file", file, "--profile", "lab"];
  const human = await f.run(app, call);
  const json = await f.run(app, [...call, "--json"]);
  const rpc: any = await f.rpc(app, [call]);
  assert.equal(writes, 3, "Each invocation must issue exactly one mutation, without retry");
  assert.equal(human.exitCode, status === expected ? 0 : 1);
  assert.equal(json.exitCode, status === expected ? 0 : 1);
  if (status === expected) {
    assert.equal(JSON.parse(json.stdout).acknowledged, true);
    assert.equal(rpc[0].result?.acknowledged, true);
  } else {
    const code = status < 300 ? "nexus.mutation.acknowledgementUnknown" : status === 401 ? "http.unauthorized" : "http.forbidden";
    assert.equal(JSON.parse(json.stderr).error.code, code);
    assert.ok(JSON.stringify(rpc).includes(code));
    assert.equal(json.stdout, "");
    if (status < 300) {
      assert.match(human.stderr, /[Rr]econcile/);
      assert.doesNotMatch(human.stderr, /rejected/i);
    }
  }
});
