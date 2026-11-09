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
          proxy: { remoteUrl: "https://upstream.example.test/index", contentMaxAge: 1440, metadataMaxAge: 1440, preserveEncodedCharacters: true },
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

test("#677 CLI-only replay provisions and reconciles 28 synthetic repositories", async t => {
  const state = new Map<string, any>();
  const { fixture: f, app } = await offlineCli(t, http.all(/^https:\/\/nexus\.example\.test\/service\/rest\/v1\/repositories\/(cargo|nuget|npm|docker)\/(hosted|proxy|group)(\/[^/]+)?$/, async ({ request }) => {
    const parts = new URL(request.url).pathname.split("/");
    const type = parts[6], name = parts[7];
    if (request.method === "GET") return state.has(name) ? HttpResponse.json(state.get(name)) : new HttpResponse(null, { status: 404 });
    const body: any = await request.json();
    if (type === "group") assert.ok(body.group.memberNames.every((n: string) => state.has(n)));
    state.set(body.name, body);
    return new HttpResponse(null, { status: request.method === "POST" ? 201 : 204 });
  }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const path = join(f.root, "replay.json");
  for (const format of ["cargo", "nuget", "npm", "docker"]) {
    const definitions: {type: string; value: any}[] = [];
    const storage = { blobStoreName: "default", strictContentTypeValidation: true };
    const docker = format === "docker" ? { docker: { v1Enabled: false, forceBasicAuth: true, pathEnabled: true } } : {};
    for (const scope of ["public", "shared", "internal"]) definitions.push({ type: "hosted", value: { name: `${format}-${scope}-hosted`, online: true, storage: { ...storage, writePolicy: "ALLOW_ONCE" }, ...docker } });
    const proxy = { name: `${format}-proxy`, online: true, storage, proxy: { remoteUrl: "https://upstream.example.test/index", contentMaxAge: 1440, metadataMaxAge: 1440 }, negativeCache: { enabled: true, timeToLive: 1440 }, httpClient: { blocked: false, autoBlock: true, connection: { timeout: 59, retries: 2, useTrustStore: true } }, ...docker, ...(format === "cargo" ? { cargo: { requireAuthentication: false } } : {}), ...(format === "nuget" ? { nugetProxy: { nugetVersion: "V3", queryCacheItemMaxAge: 3700 } } : {}), ...(format === "docker" ? { dockerProxy: { indexType: "HUB", cacheForeignLayers: false } } : {}) };
    definitions.push({ type: "proxy", value: proxy });
    const scopes = ["public", "shared", "internal"];
    for (let i = 0; i < 3; i++) definitions.push({ type: "group", value: { name: `${format}-${scopes[i]}-group`, online: true, storage, group: { memberNames: [...scopes.slice(0, i + 1).reverse().map(scope => `${format}-${scope}-hosted`), proxy.name] }, ...docker, ...(format === "cargo" ? { cargo: { requireAuthentication: i > 0 } } : {}) } });
    for (const { type, value } of definitions) {
      await writeFile(path, JSON.stringify(value));
      const argv = ["repositories", type, format];
      assert.equal((await f.run(app, [...argv, "create", "--input-file", path, "--profile", "lab", "--json"])).exitCode, 0);
      const read: any = await f.json(app, [...argv, "get", value.name, "--profile", "lab"]);
      assert.deepEqual(read, value);
      // Reconcile existing settings without losing unrelated supported fields.
      await writeFile(path, JSON.stringify({ ...read, online: false }));
      assert.equal((await f.run(app, [...argv, "update", value.name, "--input-file", path, "--profile", "lab", "--json"])).exitCode, 0);
      assert.deepEqual(state.get(value.name), { ...value, online: false });
    }
  }
  assert.equal(state.size, 28);
  assert.equal(state.get("nuget-proxy").nugetProxy.queryCacheItemMaxAge, 3700);
  assert.equal(state.get("nuget-proxy").httpClient.connection.timeout, 59);
});

test("#682 NuGet proxy preserves response-only storage write policy", async t => {
  const response = {
    name: "proxy", online: true,
    storage: { blobStoreName: "default", strictContentTypeValidation: true, writePolicy: "ALLOW" },
    cleanup: null,
    proxy: { remoteUrl: "https://upstream.example.test/index", contentMaxAge: 1440, metadataMaxAge: 1440, preserveEncodedCharacters: false },
    negativeCache: { enabled: true, timeToLive: 1440 },
    httpClient: { blocked: false, autoBlock: true, authentication: null, connection: {
      retries: null, userAgentSuffix: null, timeout: null,
      enableCircularRedirects: false, enableCookies: false, useTrustStore: false,
    } },
    routingRuleName: null,
    nugetProxy: { nugetVersion: "V3", queryCacheItemMaxAge: 3600, symbolServerUrl: null, allowAnonymousSymbolAccess: false },
    replication: { preemptivePullEnabled: false, assetPathRegex: null },
  };
  const { fixture: f, app } = await offlineCli(t, http.get("https://nexus.example.test/service/rest/v1/repositories/nuget/proxy/proxy", () => HttpResponse.json(response)));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const argv = ["repositories", "proxy", "nuget", "get", "proxy", "--profile", "lab"];
  const get = await f.run(app, [...argv, "--json"]);
  assert.equal(get.exitCode, 0, get.stderr); assert.deepEqual(JSON.parse(get.stdout), response);
  const rpc: any = await f.rpc(app, [argv]); assert.deepEqual(rpc[0].result, response);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "response.json"); await writeFile(file, JSON.stringify(response));
  const update = await f.run(app, ["repositories", "proxy", "nuget", "update", "proxy", "--input-file", file, "--profile", "lab", "--json"]);
  assert.equal(JSON.parse(update.stderr).error.code, "usage.invalid");
});

function source397Proxy(format: "npm" | "docker"): Record<string, any> {
  return {
    name: "proxy", online: false, format, type: "proxy", url: "https://nexus.example.test/repository/proxy/",
    storage: { blobStoreName: "default", strictContentTypeValidation: true, writePolicy: "ALLOW" },
    cleanup: null,
    proxy: { remoteUrl: "https://upstream.example.test/", contentMaxAge: 1440, metadataMaxAge: 1440, preserveEncodedCharacters: false },
    negativeCache: { enabled: true, timeToLive: 1440 },
    httpClient: { blocked: false, autoBlock: true, authentication: null, connection: {
      retries: null, userAgentSuffix: null, timeout: null, enableCircularRedirects: false, enableCookies: false, useTrustStore: false,
    } },
    routingRuleName: null, replication: { preemptivePullEnabled: false, assetPathRegex: null },
    ...(format === "npm" ? { npm: { removeQuarantinedVersions: false } } : {
      docker: { v1Enabled: false, forceBasicAuth: true, httpPort: null, httpsPort: null, subdomain: null, pathEnabled: true },
      dockerProxy: { indexType: "HUB", indexUrl: null, cacheForeignLayers: false, foreignLayerUrlWhitelist: null, ecrAuth: null, layerDownloadTimeoutMinutes: null },
    }),
  };
}
for (const format of ["npm", "docker"] as const) test(`#677 3.97 ${format} proxy GET and activation preserve writable settings`, async t => {
  const response = source397Proxy(format);
  const { format: _format, type: _type, url: _url, ...request } = structuredClone(response);
  const { writePolicy: _writePolicy, ...storage } = request.storage;
  const activation = { ...request, online: true, storage };
  let writes = 0;
  const route = `https://nexus.example.test/service/rest/v1/repositories/${format}/proxy`;
  const { fixture: f, app } = await offlineCli(t,
    http.get(route + "/proxy", () => HttpResponse.json(response)),
    http.put(route + "/proxy", async ({ request }) => { writes++; assert.deepEqual(await request.json(), activation); return new HttpResponse(null, { status: 204 }); }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const get = ["repositories", "proxy", format, "get", "proxy", "--profile", "lab"];
  assert.equal((await f.run(app, get)).exitCode, 0);
  assert.deepEqual(await f.json(app, get), response);
  const rpc: any = await f.rpc(app, [get]); assert.deepEqual(rpc[0].result, response);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "activation.json"); await writeFile(file, JSON.stringify(activation));
  const put = ["repositories", "proxy", format, "update", "proxy", "--input-file", file, "--profile", "lab"];
  assert.equal((await f.run(app, put)).exitCode, 0);
  assert.equal((await f.json(app, put) as any).acknowledged, true);
  const putRpc: any = await f.rpc(app, [put]); assert.equal(putRpc[0].result?.acknowledged, true);
  assert.equal(writes, 3);
  // Observation-only hosted storage policy must not become a proxy deployment setting.
  await writeFile(file, JSON.stringify({ ...activation, storage: response.storage }));
  const invalid = await f.run(app, [...put, "--json"]);
  assert.equal(JSON.parse(invalid.stderr).error.code, "usage.invalid"); assert.equal(writes, 3);
});
for (const flag of [false, true, null]) test(`#677 npm proxy canonical legacy toggle ${flag} reaches create and update`, async t => {
  const { format: _format, type: _type, url: _url, ...body } = source397Proxy("npm");
  const { writePolicy: _writePolicy, ...storage } = body.storage;
  const input = { ...body, storage, npm: { removeQuarantinedVersions: flag } };
  let writes = 0;
  const handler = async ({ request }: { request: Request }) => { writes++; assert.deepEqual(await request.json(), input); return new HttpResponse(null, { status: request.method === "POST" ? 201 : 204 }); };
  const route = "https://nexus.example.test/service/rest/v1/repositories/npm/proxy";
  const { fixture: f, app } = await offlineCli(t, http.post(route, handler), http.put(route + "/proxy", handler));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "npm.json"); await writeFile(file, JSON.stringify(input));
  for (const action of [["create"], ["update", "proxy"]]) {
    const result = await f.run(app, ["repositories", "proxy", "npm", ...action, "--input-file", file, "--profile", "lab", "--json"]);
    assert.equal(result.exitCode, 0, result.stderr);
  }
  assert.equal(writes, 2);
});
for (const timeout of [1, 1440, 0, 1441, 1.5, "10"]) test(`#677 Docker proxy layer timeout native constraint ${timeout}`, async t => {
  const observed = source397Proxy("docker");
  const { format: _format, type: _type, url: _url, ...body } = observed;
  const { writePolicy: _writePolicy, ...storage } = body.storage;
  const input = { ...body, storage, dockerProxy: { ...body.dockerProxy, layerDownloadTimeoutMinutes: timeout } };
  let writes = 0;
  const { fixture: f, app } = await offlineCli(t, http.put("https://nexus.example.test/service/rest/v1/repositories/docker/proxy/proxy", async ({ request }) => {
    writes++; assert.deepEqual(await request.json(), input); return new HttpResponse(null, { status: 204 });
  }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "docker.json"); await writeFile(file, JSON.stringify(input));
  const result = await f.run(app, ["repositories", "proxy", "docker", "update", "proxy", "--input-file", file, "--profile", "lab", "--json"]);
  const valid = timeout === 1 || timeout === 1440;
  assert.equal(result.exitCode, valid ? 0 : 2, result.stderr); assert.equal(writes, valid ? 1 : 0);
});
for (const format of ["npm", "docker"] as const) test(`#677 3.97 ${format} proxy rejects malformed observations and unknown mutation fields`, async t => {
  const value: any = source397Proxy(format);
  let writes = 0;
  const route = `https://nexus.example.test/service/rest/v1/repositories/${format}/proxy`;
  const { fixture: f, app } = await offlineCli(t, http.get(route + "/proxy", () => HttpResponse.json(value)), http.put(route + "/proxy", () => { writes++; return new HttpResponse(null, { status: 204 }); }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const get = ["repositories", "proxy", format, "get", "proxy", "--profile", "lab", "--json"];
  value.storage.writePolicy = 42;
  assert.equal(JSON.parse((await f.run(app, get)).stderr).error.code, "nexus.decodeFailed");
  value.storage.writePolicy = "ALLOW";
  if (format === "npm") value.npm.removeQuarantinedVersions = "false";
  else value.dockerProxy.layerDownloadTimeoutMinutes = "10";
  assert.equal(JSON.parse((await f.run(app, get)).stderr).error.code, "nexus.decodeFailed");
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const { format: _format, type: _type, url: _url, ...body } = source397Proxy(format);
  const { writePolicy: _writePolicy, ...storage } = body.storage;
  const file = join(f.root, "unknown.json");
  await writeFile(file, JSON.stringify({ ...body, storage, ...(format === "npm" ? { npm: { removeQuarantinedVersions: false, invented: true } } : { dockerProxy: { ...body.dockerProxy, invented: true } }) }));
  const result = await f.run(app, ["repositories", "proxy", format, "update", "proxy", "--input-file", file, "--profile", "lab", "--json"]);
  assert.equal(JSON.parse(result.stderr).error.code, "usage.invalid"); assert.equal(writes, 0);
});
