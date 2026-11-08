import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";

const base = "https://nexus.example.test/service/rest/v1/";
const asset = {
  id: "opaque+/=", repository: "releases", format: "raw", path: "demo.txt",
  downloadUrl: "https://nexus.example.test/repository/releases/demo.txt",
  checksum: { sha256: "a".repeat(64) }, contentType: "text/plain",
  lastModified: "2026-01-01T00:00:00Z", lastDownloaded: null,
  uploader: "synthetic-user", uploaderIp: "192.0.2.1", fileSize: Number.MAX_SAFE_INTEGER,
  blobCreated: "2026-01-01T00:00:00Z", blobStoreName: "synthetic-store",
  blobUpdated: "2026-01-01T00:00:00Z", blobRef: "synthetic-reference",
  lastVerified: null, registryUrl: "https://registry.example.test",
};
const component = {
  id: "opaque+/=", repository: "releases", format: "raw", group: null,
  name: "demo.txt", version: null, assets: [asset],
  extraJsonAttributes: { synthetic: { value: false } }, tags: ["synthetic"],
};
async function configure(f: Awaited<ReturnType<typeof offlineCli>>["fixture"], a: Awaited<ReturnType<typeof offlineCli>>["app"]) {
  assert.equal((await f.run(a, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"])).exitCode, 0);
}

// Qualify field retention at the representable integer boundary. This does not
// establish lossless decoding for the complete OpenAPI int64 range.
// This is audit evidence for shipped commands, not a new story or new REST operation.
for (const kind of ["assets", "components"] as const) for (const detail of [false, true]) {
  test(`Coverage baseline ${kind} ${detail ? "detail" : "page"} retains pinned DTO fields at safe integer sizes`, async t => {
    const expected = kind === "assets" ? asset : component;
    let calls = 0;
    const route = kind + (detail ? "/opaque%2B%2F%3D" : "");
    const { fixture: f, app: a } = await offlineCli(t, http.get(base + route, ({ request }) => {
      calls++;
      const url = new URL(request.url);
      assert.deepEqual([...url.searchParams], detail ? [] : [["repository", "releases"], ["continuationToken", "resume+/="]]);
      return HttpResponse.json(detail ? expected : { items: [expected], continuationToken: null });
    }));
    await configure(f, a);
    const argv = detail ? [kind, "get", asset.id] : [kind, "list", "--repository", "releases", "--continuation-token", "resume+/="];
    const value: any = await f.json(a, [...argv, "--profile", "lab"]);
    assert.deepEqual(detail ? value : value.items[0], expected);
    const rpc: any = await f.rpc(a, [[...argv, "--profile", "lab"]]);
    assert.deepEqual(detail ? rpc[0].result : rpc[0].result.items[0], expected);
    assert.equal(calls, 2);
  });
  test(`Coverage baseline ${kind} ${detail ? "detail" : "page"} rejects documented 422`, async t => {
    let calls = 0;
    const { fixture: f, app: a } = await offlineCli(t, http.get(base + kind + (detail ? "/opaque" : ""), () => {
      calls++;
      return new HttpResponse("synthetic-private-response", { status: 422 });
    }));
    await configure(f, a);
    const argv = [...(detail ? [kind, "get", "opaque"] : [kind, "list", "--repository", "releases"]), "--profile", "lab"];
    const r = await f.run(a, [...argv, "--json"]);
    assert.equal(r.exitCode, 1);
    const error = JSON.parse(r.stderr).error;
    assert.equal(error.code, detail ? "http.rejected" : "nexus.pagination.fetchFailed");
    if (detail) assert.equal(r.stdout, "");
    else assert.deepEqual(JSON.parse(r.stdout).resume, { restart: true, token: null });
    assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private-response/);
    const rpc: any = await f.rpc(a, [argv]);
    assert.equal(rpc[0].error.data.code, error.code);
    assert.equal(calls, 2);
  });
}

for (const status of [200, 503]) test(`Coverage baseline writable status ${status} follows a successful readable check`, async t => {
  const paths: string[] = [];
  const { fixture: f, app: a } = await offlineCli(t,
    http.get(base + "status", () => { paths.push("status"); return new HttpResponse(null, { status: 200 }); }),
    http.get(base + "status/writable", () => { paths.push("writable"); return new HttpResponse("synthetic-private-response", { status }); }));
  await configure(f, a);
  const argv = ["status", "--profile", "lab"];
  const r = await f.run(a, [...argv, "--json"]);
  assert.equal(r.exitCode, status === 200 ? 0 : 1);
  if (status === 200) assert.deepEqual(JSON.parse(r.stdout), { readable: true, writable: true });
  else { assert.equal(r.stdout, ""); assert.equal(JSON.parse(r.stderr).error.code, "http.serverError"); }
  const rpc: any = await f.rpc(a, [argv]);
  if (status === 200) assert.deepEqual(rpc[0].result, { readable: true, writable: true });
  else assert.equal(rpc[0].error.data.code, "http.serverError");
  assert.deepEqual(paths, ["status", "writable", "status", "writable"]);
  assert.doesNotMatch(r.stdout + r.stderr + JSON.stringify(rpc), /synthetic-private-response/);
});

for (const kind of ["assets", "components"]) for (const status of [404, 422]) {
  test(`Coverage baseline ${kind} DELETE ${status} after exact preflight does not retry`, async t => {
    const methods: string[] = [];
    const url = base + kind + "/opaque";
    const { fixture: f, app: a } = await offlineCli(t,
      http.get(url, () => { methods.push("GET"); return HttpResponse.json({ id: "opaque", assets: [] }); }),
      http.delete(url, () => { methods.push("DELETE"); return new HttpResponse("synthetic-private-response", { status }); }));
    await configure(f, a);
    assert.equal((await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"])).exitCode, 0);
    const r = await f.run(a, [kind, "delete", "opaque", "--confirm-id", "opaque", "--profile", "lab", "--json"]);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    assert.equal(JSON.parse(r.stderr).error.code, status === 404 ? "http.notFound" : "http.rejected");
    assert.deepEqual(methods, ["GET", "DELETE"]);
    assert.doesNotMatch(r.stderr, /synthetic-private-response/);
  });
}
