import assert from "node:assert/strict";
import test from "node:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { createCli } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createDefinition } from "../src/cli.js";
import { offlineCli } from "./offline.js";

// #677: these source-shaped observations must reach their typed routes.
for (const format of ["cargo", "nuget", "npm", "docker"]) {
  for (const type of ["hosted", "proxy", "group"]) {
    test(`#677 ${format} ${type} observes complete settings`, async t => {
      const expected = {
        name: "synthetic-repository", online: true,
        storage: { blobStoreName: "default", strictContentTypeValidation: true,
          ...(type === "hosted" ? { writePolicy: "ALLOW_ONCE" } : {}) },
        ...(type === "group" ? { group: { memberNames: ["public", "upstream"] } } : {}),
        ...(type === "proxy" ? {
          proxy: { remoteUrl: "https://upstream.example.test/index", contentMaxAge: 1440, metadataMaxAge: 1440 },
          negativeCache: { enabled: true, timeToLive: 1440 },
          httpClient: { blocked: false, autoBlock: true },
        } : {}),
        ...(format === "cargo" && type !== "hosted" ? { cargo: { requireAuthentication: true } } : {}),
        ...(format === "nuget" && type === "proxy" ? { nugetProxy: { queryCacheItemMaxAge: 3600, nugetVersion: "V3" } } : {}),
        ...(format === "docker" && type === "proxy" ? { dockerProxy: { indexType: "HUB", cacheForeignLayers: false, foreignLayerUrlWhitelist: [] } } : {}),
        ...(format === "docker" ? { docker: { v1Enabled: false, forceBasicAuth: true, httpPort: null, httpsPort: null, subdomain: null } } : {}),
      };
      let calls = 0;
      const { fixture: f, app, server } = await offlineCli(t,
        http.get(`https://nexus.example.test/service/rest/v1/repositories/${format}/${type}/synthetic-repository`, () => {
          calls++;
          return HttpResponse.json(expected);
        }));
      await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
      const result = await f.run(app, ["repositories", type, format, "get", "synthetic-repository", "--profile", "lab", "--json"]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.equal(calls, 1);
      assert.deepEqual(JSON.parse(result.stdout), expected);
      const rpc: any = await f.rpc(app, [["repositories", type, format, "get", "synthetic-repository", "--profile", "lab"]]);
      assert.deepEqual(rpc[0].result, expected);
      const inputFile = join(f.root, "repository.json");
      let writes = 0;
      const route = `https://nexus.example.test/service/rest/v1/repositories/${format}/${type}`;
      for (const [action, method, status] of [["create", "post", 201], ["update", "put", 204]] as const) {
        const handler = http[method](route + (action === "update" ? "/synthetic-repository" : ""), async ({ request }) => {
          writes++;
          assert.deepEqual(await request.json(), expected);
          return new HttpResponse(null, { status });
        });
        server.use(handler);
        const argv = ["repositories", type, format, action, ...(action === "update" ? [expected.name] : []), "--input-file", inputFile, "--profile", "lab", "--json"];
        await writeFile(inputFile, JSON.stringify(expected), { mode: 0o600 });
        const denied = await f.run(app, argv);
        assert.equal(JSON.parse(denied.stderr).error.code, "permission.denied");
        assert.equal(writes, action === "create" ? 0 : 1);
        await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
        const written = await f.run(app, argv);
        assert.equal(written.exitCode, 0, written.stderr);
        assert.equal(JSON.parse(written.stdout).acknowledged, true);
        await writeFile(inputFile, JSON.stringify({ ...expected, unknownSetting: true }));
        const invalid = await f.run(app, argv);
        assert.notEqual(invalid.exitCode, 0);
        assert.equal(writes, action === "create" ? 1 : 2);
        await f.run(app, ["permissions", "revoke", "Update", "--profile", "lab"]);
      }
    });
  }
}

test("#677 typed configuration rejects malformed fields and redacts write-only secrets", async t => {
  const base = {
    name: "proxy", online: true,
    storage: { blobStoreName: "default", strictContentTypeValidation: true },
    proxy: { remoteUrl: "https://synthetic:SYNTHETIC_URL_PASSWORD@upstream.example.test/?token=SYNTHETIC_QUERY", contentMaxAge: -1, metadataMaxAge: 0 },
    negativeCache: { enabled: false, timeToLive: 0 },
    httpClient: { authentication: { type: "username", username: "synthetic", password: "SYNTHETIC_SECRET", bearerToken: "SYNTHETIC_TOKEN" } },
  };
  let writes = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.get("https://nexus.example.test/service/rest/v1/repositories/npm/proxy/proxy", () => HttpResponse.json(base)),
    http.put("https://nexus.example.test/service/rest/v1/repositories/npm/proxy/proxy", () => { writes++; return new HttpResponse(null, { status: 204 }); }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const get = await f.run(app, ["repositories", "proxy", "npm", "get", "proxy", "--profile", "lab", "--json"]);
  assert.equal(get.exitCode, 0, get.stderr);
  assert.doesNotMatch(get.stdout + get.stderr, /SYNTHETIC_SECRET|SYNTHETIC_TOKEN|SYNTHETIC_URL_PASSWORD|SYNTHETIC_QUERY/);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const inputFile = join(f.root, "invalid.json");
  for (const input of [
    { ...base, online: "true" },
    { ...base, name: "another" },
    { ...base, storage: { ...base.storage, unknown: true } },
    { ...base, httpClient: { connection: { retries: 1.1 } } },
  ]) {
    await writeFile(inputFile, JSON.stringify(input), { mode: 0o600 });
    const r = await f.run(app, ["repositories", "proxy", "npm", "update", "proxy", "--input-file", inputFile, "--profile", "lab", "--json"]);
    assert.notEqual(r.exitCode, 0);
    assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_SECRET|SYNTHETIC_TOKEN|SYNTHETIC_URL_PASSWORD|SYNTHETIC_QUERY/);
  }
  assert.equal(writes, 0);
});

test("#677 RPC file mutations preserve the next request and reject stdin", async t => {
  let writes = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.post("https://nexus.example.test/service/rest/v1/repositories/npm/hosted", () => { writes++; return new HttpResponse(null, { status: 201 }); }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "body.json");
  await writeFile(file, JSON.stringify({ name: "synthetic", online: true, storage: { blobStoreName: "default", strictContentTypeValidation: true, writePolicy: "ALLOW" } }));
  const prefix = ["repositories", "hosted", "npm", "create", "--profile", "lab"];
  const rows: any = await f.rpc(app, [[...prefix, "--input-stdin"], [...prefix, "--input-file", file]]);
  assert.equal(rows[0].error.data.code, "usage");
  assert.equal(rows[1].result.acknowledged, true);
  assert.equal(writes, 1);
  for (const [body, code] of [["{", "usage.invalid"], [" ".repeat(65537), "nexus.input.tooLarge"]]) {
    await writeFile(file, body);
    const r = await f.run(app, [...prefix, "--input-file", file, "--json"]);
    assert.equal(JSON.parse(r.stderr).error.code, code);
  }
  const missing = await f.run(app, [...prefix, "--input-file", file + ".absent", "--json"]);
  assert.equal(JSON.parse(missing.stderr).error.code, "nexus.input.unavailable");
  assert.equal(writes, 1);
});

for (const encoding of ["raw", "json", "uri", "url-password", "url-query"]) test(`#677 DTO secret diagnostics ${encoding}`, async t => {
  const secret = 'SYNTHETIC_"PRIVATE value';
  const spell = encoding === "json" ? JSON.stringify(secret).slice(1, -1) : encoding === "uri" ? encodeURIComponent(secret) : secret;
  const f = await createCliFixture(t, { applicationId: "nexus-cli", profiles: [{ name: "lab", values: { url: "https://nexus.example.test", authMode: "anonymous" }, permissions: ["Update"] }] });
  const app = f.createApplication(runtime => createCli({ ...createDefinition(), runtime: { ...runtime, fetch: async () => { throw new Error("Synthetic socket failure " + spell); } } }));
  const path = join(f.root, "body.json");
  await writeFile(path, JSON.stringify({ name: "proxy", online: true, storage: { blobStoreName: "default", strictContentTypeValidation: true }, proxy: { remoteUrl: encoding === "url-password" ? "https://synthetic:" + encodeURIComponent(secret) + "@upstream.example.test" : encoding === "url-query" ? "https://upstream.example.test?token=" + encodeURIComponent(secret) : "https://upstream.example.test", contentMaxAge: -1, metadataMaxAge: 0 }, negativeCache: { enabled: false, timeToLive: 0 }, httpClient: { authentication: { type: "username", ...(encoding.startsWith("url-") ? {} : { password: secret }) } } }));
  const argv = ["repositories", "proxy", "npm", "create", "--input-file", path, "--profile", "lab", "--verbose"];
  const r = await f.run(app, [...argv, "--json"]);
  assert.equal(JSON.parse(r.stderr).error.code, "nexus.mutation.outcomeUnknown");
  assert.ok(!(r.stdout + r.stderr).includes("PRIVATE"));
  const rpc = JSON.stringify(await f.rpc(app, [argv]));
  assert.ok(!rpc.includes("PRIVATE"));
});

test("#677 malformed required upstream URL fails before projection", async t => {
  const { fixture: f, app } = await offlineCli(t, http.get("https://nexus.example.test/service/rest/v1/repositories/npm/proxy/proxy", () => HttpResponse.json({ name: "proxy", online: true, storage: { blobStoreName: "default", strictContentTypeValidation: true }, proxy: { remoteUrl: "", contentMaxAge: 0, metadataMaxAge: 0 }, negativeCache: { enabled: false, timeToLive: 0 }, httpClient: {} })));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const r = await f.run(app, ["repositories", "proxy", "npm", "get", "proxy", "--profile", "lab", "--json"]);
  assert.equal(JSON.parse(r.stderr).error.code, "nexus.decodeFailed");
});
