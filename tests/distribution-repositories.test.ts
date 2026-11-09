import assert from "node:assert/strict";
import test from "node:test";
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
        ...(format === "docker" ? { docker: { v1Enabled: false, forceBasicAuth: true, httpPort: null, httpsPort: null, subdomain: null } } : {}),
      };
      let calls = 0;
      const { fixture: f, app } = await offlineCli(t,
        http.get(`https://nexus.example.test/service/rest/v1/repositories/${format}/${type}/synthetic-repository`, () => {
          calls++;
          return HttpResponse.json(expected);
        }));
      await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
      const result = await f.run(app, ["repositories", type, format, "get", "synthetic-repository", "--profile", "lab", "--json"]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.equal(calls, 1);
      assert.deepEqual(JSON.parse(result.stdout), expected);
    });
  }
}
