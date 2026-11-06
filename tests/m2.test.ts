import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";
const base = "https://nexus.example.test/service/rest/v1/";
for (const [story, argv, path, detail] of [
  [
    "S08",
    ["components", "list", "--repository", "releases"],
    "components",
    false,
  ],
  ["S09", ["components", "get", "a/b"], "components/a%2Fb", true],
  ["S10", ["assets", "list", "--repository", "releases"], "assets", false],
  ["S11", ["assets", "get", "a/b"], "assets/a%2Fb", true],
  ["S12", ["search", "components", "--name", "widget"], "search", false],
  [
    "S13",
    ["search", "assets", "--maven-classifier", ""],
    "search/assets",
    false,
  ],
] as const)
  test(`${story} real command returns metadata`, async (t) => {
    const { fixture: f, app: a } = await offlineCli(
      t,
      http.get(base + path, ({ request }) => {
        if (story === "S13")
          assert.equal(
            new URL(request.url).searchParams.get("maven.classifier"),
            "",
          );
        return HttpResponse.json(
          detail
            ? { id: "a/b", path: "widget" }
            : {
                items: [{ id: "a/b", path: "widget" }],
                continuationToken: null,
              },
        );
      }),
    );
    await f.run(a, [
      "profile",
      "configure",
      "lab",
      "--url",
      "https://nexus.example.test",
      "--auth-mode",
      "anonymous",
    ]);
    const r: any = await f.json(a, [...argv, "--profile", "lab"]);
    assert.equal(detail ? r.id : r.items[0].id, "a/b");
  });
test("S14 rejects page two whole and resumes its input token", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(base + "assets", ({ request }) =>
      new URL(request.url).searchParams.has("continuationToken")
        ? new HttpResponse(null, { status: 403 })
        : HttpResponse.json({
            items: [{ id: "one" }],
            continuationToken: "opaque+/=",
          }),
    ),
  );
  await f.run(a, [
    "profile",
    "configure",
    "lab",
    "--url",
    "https://nexus.example.test",
    "--auth-mode",
    "anonymous",
  ]);
  const r = await f.run(a, [
    "assets",
    "list",
    "--repository",
    "releases",
    "--all",
    "--profile",
    "lab",
    "--json",
  ]);
  assert.equal(r.exitCode, 1);
  const d = JSON.parse(r.stdout);
  assert.equal(d.items.length, 1);
  assert.deepEqual(d.resume, { restart: false, token: "opaque+/=" });
});
for (const [label, response, extra, code] of [
  ["empty", { items: [], continuationToken: null }, [], null],
  ["empty next", { items: [], continuationToken: "next" }, [], null],
  [
    "page cap",
    { items: [], continuationToken: "next" },
    ["--all", "--max-pages", "1"],
    "pageBudget",
  ],
  [
    "repeated",
    { items: [], continuationToken: "next" },
    ["--all"],
    "repeatedToken",
  ],
  [
    "item budget",
    { items: [{ id: "a" }, { id: "b" }], continuationToken: null },
    ["--max-items", "1"],
    "itemBudget",
  ],
  [
    "byte budget",
    { items: [{ id: "a", path: "x".repeat(1000) }], continuationToken: null },
    ["--max-page-bytes", "100"],
    "byteBudget",
  ],
  [
    "result budget",
    { items: [{ id: "a", path: "x".repeat(1000) }], continuationToken: null },
    ["--max-result-bytes", "300"],
    "byteBudget",
  ],
  ["bad shape", { items: [{}], continuationToken: null }, [], "decodeFailed"],
] as const)
  test(`S14 ${label} across JSON and RPC`, async (t) => {
    const { fixture: f, app: a } = await offlineCli(
      t,
      http.get(base + "assets", () => HttpResponse.json(response)),
    );
    await f.run(a, [
      "profile",
      "configure",
      "lab",
      "--url",
      "https://nexus.example.test",
      "--auth-mode",
      "anonymous",
    ]);
    const argv = [
      "assets",
      "list",
      "--repository",
      "releases",
      "--profile",
      "lab",
      ...extra,
    ];
    const r = await f.run(a, [...argv, "--json"]);
    assert.equal(r.exitCode, code ? 1 : 0);
    const d = JSON.parse(r.stdout);
    assert.equal(d.reason, code);
    if (code) {
      assert.equal(JSON.parse(r.stderr).error.code, "nexus.pagination." + code);
      if (code === "repeatedToken") assert.equal(d.resume, null);
      else if (code !== "pageBudget")
        assert.deepEqual(d.resume, { restart: true, token: null });
    }
    const rpc: any = await f.rpc(a, [argv]);
    assert.deepEqual(code ? rpc[0].error.data.result : rpc[0].result, d);
    if (label === "result budget") {
      assert.ok(Buffer.byteLength(r.stdout.trim(), "utf8") <= 300);
      assert.ok(Buffer.byteLength(JSON.stringify(rpc[0].error.data.result), "utf8") <= 300);
    }
    const human = await f.run(a, argv);
    assert.equal(human.exitCode, r.exitCode);
    assert.match(human.stdout, /Items/);
  });
for (const status of [401, 403, 404, 500])
  test(`S09/S11 HTTP ${status} retains safe errors`, async (t) => {
    const { fixture: f, app: a } = await offlineCli(
      t,
      http.get(
        base + "assets/:id",
        () => new HttpResponse("synthetic-private-body", { status }),
      ),
    );
    await f.run(a, [
      "profile",
      "configure",
      "lab",
      "--url",
      "https://nexus.example.test",
      "--auth-mode",
      "anonymous",
    ]);
    const r = await f.run(a, [
      "assets",
      "get",
      "opaque+/=",
      "--profile",
      "lab",
      "--json",
    ]);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    assert.ok(!r.stderr.includes("synthetic-private-body"));
  });
test("S08–S14 inherit profile auth and deny ReadOnly before HTTP", async (t) => {
  const { fixture: f, app: a } = await offlineCli(t);
  await f.run(a, [
    "profile",
    "configure",
    "lab",
    "--url",
    "https://nexus.example.test",
    "--auth-mode",
    "anonymous",
  ]);
  await f.run(a, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]);
  for (const argv of [
    ["components", "list", "--repository", "releases"],
    ["components", "get", "opaque"],
    ["assets", "list", "--repository", "releases"],
    ["assets", "get", "opaque"],
    ["search", "components"],
    ["search", "assets"],
  ]) {
    const r = await f.run(a, [...argv, "--profile", "lab", "--json"]);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /permission/i);
  }
});
test("S11 redacts metadata URL credentials; S10 malformed JSON gives restart", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(base + "assets/:id", () =>
      HttpResponse.json({
        id: "a",
        downloadUrl:
          "https://synthetic:private@nexus.example.test/a?token=private",
      }),
    ),
    http.get(base + "assets", () => new HttpResponse("{invalid")),
  );
  await f.run(a, [
    "profile",
    "configure",
    "lab",
    "--url",
    "https://nexus.example.test",
    "--auth-mode",
    "anonymous",
  ]);
  const d: any = await f.json(a, ["assets", "get", "a", "--profile", "lab"]);
  assert.equal(d.downloadUrl, "https://nexus.example.test/a");
  const r = await f.run(a, [
    "assets",
    "list",
    "--repository",
    "releases",
    "--profile",
    "lab",
    "--json",
  ]);
  assert.equal(r.exitCode, 1);
  assert.deepEqual(JSON.parse(r.stdout).resume, { restart: true, token: null });
  assert.ok(!r.stderr.includes("{invalid"));
});
test("S14 accepts a resumed opaque token and completes all pages", async (t) => {
  const tokens: (string | null)[] = [];
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(base + "components", ({ request }) => {
      const token = new URL(request.url).searchParams.get("continuationToken");
      tokens.push(token);
      return HttpResponse.json({
        items: token === "opaque+/=" ? [] : [{ id: "last" }],
        continuationToken: token === "opaque+/=" ? "final" : null,
      });
    }),
  );
  await f.run(a, [
    "profile",
    "configure",
    "lab",
    "--url",
    "https://nexus.example.test",
    "--auth-mode",
    "anonymous",
  ]);
  const d: any = await f.json(a, [
    "components",
    "list",
    "--repository",
    "releases",
    "--continuation-token",
    "opaque+/=",
    "--all",
    "--profile",
    "lab",
  ]);
  assert.deepEqual(tokens, ["opaque+/=", "final"]);
  assert.equal(d.complete, true);
  assert.equal(d.pagesFetched, 2);
  assert.deepEqual(d.items, [{ id: "last" }]);
  assert.equal(d.resume, null);
});

for (const [name, budget, token] of [
  ["tiny result budget", 1, undefined],
  ["oversized initial checkpoint", 300, "opaque".repeat(100)],
] as const) test(`S14 rejects ${name} before HTTP in JSON and RPC`, async (t) => {
  let calls = 0;
  const {fixture: f, app: a, server} = await offlineCli(t,
    http.get(base + "assets", () => HttpResponse.json({items: [], continuationToken: null})),
  );
  await f.run(a, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  server.events.on("request:start", () => { calls++; });
  const argv = ["assets", "list", "--repository", "releases", "--profile", "lab", "--max-result-bytes", String(budget), ...(token ? ["--continuation-token", token] : [])];
  const result = await f.run(a, [...argv, "--json"]);
  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, "");
  assert.equal(JSON.parse(result.stderr).error.code, "usage");
  const replies: any[] = await f.rpc(a, [argv]);
  assert.equal(replies[0].error.data.exitCode, 2);
  assert.equal(replies[0].error.data.result, undefined);
  assert.equal(calls, 0);
});

for (const kind of ["assets", "components", "repositories"]) {
  for (const id of [".", ".."]) test(`Detail ${kind} rejects navigation ID ${id} before HTTP`, async (t) => {
    let calls = 0;
    const {fixture: f, app: a, server} = await offlineCli(t,
      http.get("*", () => HttpResponse.json({id: "wrong", name: "wrong", format: "raw", type: "hosted", url: "https://nexus.example.test/repository/wrong"})),
    );
    await f.run(a, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
    server.events.on("request:start", () => { calls++; });
    const argv = [kind, "get", id, "--profile", "lab"];
    const result = await f.run(a, [...argv, "--json"]);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, "");
    assert.equal(JSON.parse(result.stderr).error.code, "usage");
    const replies: any[] = await f.rpc(a, [argv]);
    assert.equal(replies[0].error.data.exitCode, 2);
    assert.equal(calls, 0);
  });
}
