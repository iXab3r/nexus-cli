import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { http, HttpResponse } from "msw";
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
      let writes = 0;
      const route = `https://nexus.example.test/service/rest/v1/repositories/${format}/${type}`;
      for (const [action, method, status] of [["create", "post", 201], ["update", "put", 204]] as const) {
        const handler = http[method](route + (action === "update" ? "/synthetic-repository" : ""), async ({ request }) => {
          writes++;
          assert.deepEqual(await request.json(), expected);
          return new HttpResponse(null, { status });
        });
        server.use(handler);
        const argv = ["repositories", type, format, action, ...(action === "update" ? [expected.name] : []), "--input-stdin", "--profile", "lab", "--json"];
        const denied = await f.run(app, argv, { input: Readable.from([JSON.stringify(expected)]) });
        assert.equal(JSON.parse(denied.stderr).error.code, "permission.denied");
        assert.equal(writes, action === "create" ? 0 : 1);
        await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
        const written = await f.run(app, argv, { input: Readable.from([JSON.stringify(expected)]) });
        assert.equal(written.exitCode, 0, written.stderr);
        assert.equal(JSON.parse(written.stdout).acknowledged, true);
        const invalid = await f.run(app, argv, { input: Readable.from([JSON.stringify({ ...expected, unknownSetting: true })]) });
        assert.notEqual(invalid.exitCode, 0);
        assert.equal(writes, action === "create" ? 1 : 2);
        await f.run(app, ["permissions", "revoke", "Update", "--profile", "lab"]);
      }
    });
  }
}
