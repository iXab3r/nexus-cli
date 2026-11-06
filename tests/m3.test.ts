import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";
const base = "https://nexus.example.test/service/rest/v1/";
for (const kind of ["assets", "components"])
  for (const scenario of [
    "success",
    "confirm",
    "gate",
    "preflight",
    "denied",
    "unknown",
  ])
    test(`${kind} delete ${scenario}`, async (t) => {
      let gets = 0,
        deletes = 0;
      const { fixture: f, app: a } = await offlineCli(
        t,
        http.get(base + kind + "/a%2Fb", () => {
          gets++;
          return scenario === "preflight"
            ? new HttpResponse(null, { status: 404 })
            : HttpResponse.json({ id: "a/b", assets: [{ id: "one" }] });
        }),
        http.delete(base + kind + "/a%2Fb", () => {
          deletes++;
          return scenario === "unknown"
            ? HttpResponse.error()
            : new HttpResponse(null, {
                status: scenario === "denied" ? 403 : 204,
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
      if (scenario !== "gate")
        await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"]);
      const r = await f.run(a, [
        kind,
        "delete",
        "a/b",
        "--confirm-id",
        scenario === "confirm" ? "wrong" : "a/b",
        "--profile",
        "lab",
        "--json",
      ]);
      assert.equal(
        r.exitCode,
        scenario === "success" ? 0 : scenario === "confirm" ? 2 : 1,
      );
      assert.equal(gets, ["confirm", "gate"].includes(scenario) ? 0 : 1);
      assert.equal(
        deletes,
        ["confirm", "gate", "preflight"].includes(scenario) ? 0 : 1,
      );
      if (scenario === "success") assert.equal(JSON.parse(r.stdout).id, "a/b");
      if (scenario === "unknown")
        assert.match(r.stderr, /nexus.mutation.outcomeUnknown/);
    });
test("S17 upload specification", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(base + "formats/upload-specs/raw", () =>
      HttpResponse.json({
        format: "raw",
        multipleUpload: true,
        componentFields: [],
        assetFields: [],
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
  assert.equal(
    (
      (await f.json(a, [
        "formats",
        "upload-specs",
        "get",
        "raw",
        "--profile",
        "lab",
      ])) as any
    ).format,
    "raw",
  );
});
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
for (const format of ["raw", "maven"])
  test(`${format} multipart upload`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "nexus-upload-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const file = join(dir, "widget.jar");
    await writeFile(file, "synthetic jar");
    let form: FormData | undefined;
    const { fixture: f, app: a } = await offlineCli(
      t,
      http.post(base + "components", async ({ request }) => {
        assert.equal(
          new URL(request.url).searchParams.get("repository"),
          "releases",
        );
        form = await request.formData();
        return new HttpResponse(null, { status: 204 });
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
    await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"]);
    const r = await f.run(a, [
      "components",
      "upload",
      format,
      "--repository",
      "releases",
      "--file",
      file,
      ...(format === "raw"
        ? ["--directory", "/"]
        : [
            "--group",
            "com.example",
            "--artifact",
            "widget",
            "--artifact-version",
            "1.0",
            "--extension",
            "jar",
          ]),
      "--profile",
      "lab",
      "--json",
    ]);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).repository, "releases");
    const prefix = format === "raw" ? "raw" : "maven2";
    assert.equal(
      await (form!.get(prefix + ".asset1") as File).text(),
      "synthetic jar",
    );
    if (format === "raw") {
      assert.equal(form!.get("raw.directory"), "/");
      assert.equal(form!.get("raw.asset1.filename"), "widget.jar");
    } else {
      assert.equal(form!.get("maven2.generate-pom"), "true");
      assert.equal(form!.get("maven2.asset1.extension"), "jar");
      assert.equal(form!.get("maven2.groupId"), "com.example");
      assert.equal(form!.get("maven2.packaging"), "jar");
      assert.equal(form!.get("maven2.version"), "1.0");
      assert.equal(form!.get("maven2.artifactId"), "widget");
      assert.equal(form!.get("maven2.asset1.classifier"), null);
    }
  });
for (const kind of ["components", "assets"])
  test(`search ${kind} artifact version reaches Nexus`, async (t) => {
    let calls = 0;
    const { fixture: f, app: a } = await offlineCli(
      t,
      http.get(
        base + (kind === "components" ? "search" : "search/assets"),
        ({ request }) => {
          calls++;
          assert.equal(new URL(request.url).searchParams.get("version"), "1.0");
          return HttpResponse.json({ items: [], continuationToken: null });
        },
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
      "search",
      kind,
      "--artifact-version",
      "1.0",
      "--profile",
      "lab",
      "--json",
    ]);
    assert.equal(r.exitCode, 0);
    assert.equal(calls, 1);
  });
for (const status of [401, 403, 404, 500, 200])
  test(`upload specs rejects ${status}`, async (t) => {
    const { fixture: f, app: a } = await offlineCli(
      t,
      http.get(base + "formats/upload-specs/raw", () =>
        HttpResponse.json({}, { status }),
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
    const argv = ["formats", "upload-specs", "get", "raw", "--profile", "lab"];
    const r = await f.run(a, [...argv, "--json"]);
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    const rpc: any = await f.rpc(a, [argv]);
    assert.ok(rpc[0].error);
  });
for (const format of ["raw", "maven"])
  for (const scenario of [
    "gate",
    "missing",
    "directory",
    "empty",
    "denied",
    "unauthorized",
    "rejected",
    "unexpected",
    "unknown",
    "human",
    "rpc",
  ])
    test(`${format} upload ${scenario}`, async (t) => {
      const dir = await mkdtemp(join(tmpdir(), "nexus-upload-"));
      t.after(() => rm(dir, { recursive: true, force: true }));
      const file = join(dir, "widget.jar");
      await writeFile(file, "synthetic jar");
      let posts = 0;
      const { fixture: f, app: a } = await offlineCli(
        t,
        http.post(base + "components", () => {
          posts++;
          return scenario === "unknown"
            ? HttpResponse.error()
            : new HttpResponse(null, {
                status:
                  scenario === "denied"
                    ? 403
                    : scenario === "unauthorized"
                      ? 401
                      : scenario === "rejected"
                        ? 400
                        : scenario === "unexpected"
                          ? 200
                          : 204,
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
      if (scenario !== "gate")
        await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"]);
      const argv = [
        "components",
        "upload",
        format,
        "--repository",
        scenario === "empty" ? " " : "releases",
        "--file",
        scenario === "missing"
          ? join(dir, "absent")
          : scenario === "directory"
            ? dir
            : file,
        ...(format === "raw"
          ? ["--directory", "/"]
          : [
              "--group",
              "com.example",
              "--artifact",
              "widget",
              "--artifact-version",
              "1.0",
              "--extension",
              "jar",
            ]),
        "--profile",
        "lab",
      ];
      if (scenario === "rpc") {
        const r: any = await f.rpc(a, [argv]);
        assert.equal(r[0].result.acknowledged, true);
      } else {
        const r = await f.run(a, [
          ...argv,
          ...(scenario === "human" ? [] : ["--json"]),
        ]);
        assert.equal(
          r.exitCode,
          scenario === "human"
            ? 0
            : ["empty", "directory"].includes(scenario)
              ? 2
              : 1,
          r.stderr,
        );
        if (scenario === "human") assert.match(r.stdout, /releases/);
        else assert.equal(r.stdout, "");
        if (scenario === "unknown") assert.match(r.stderr, /outcomeUnknown/);
      }
      assert.equal(
        posts,
        ["gate", "missing", "directory", "empty"].includes(scenario) ? 0 : 1,
      );
    });
for (const kind of ["assets", "components"])
  test(`${kind} delete human and RPC boundaries`, async (t) => {
    let deletes = 0;
    const { fixture: f, app: a } = await offlineCli(
      t,
      http.get(base + kind + "/one", () =>
        HttpResponse.json({ id: "one", assets: [] }),
      ),
      http.delete(base + kind + "/one", () => {
        deletes++;
        return new HttpResponse(null, { status: 204 });
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
    const argv = [
      kind,
      "delete",
      "one",
      "--confirm-id",
      "one",
      "--profile",
      "lab",
    ];
    const denied: any = await f.rpc(a, [argv]);
    assert.ok(denied[0].error);
    assert.equal(deletes, 0);
    await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"]);
    const mismatch: any = await f.rpc(a, [
      [kind, "delete", "one", "--confirm-id", "wrong", "--profile", "lab"],
    ]);
    assert.ok(mismatch[0].error);
    assert.equal(deletes, 0);
    const human = await f.run(a, argv);
    assert.equal(human.exitCode, 0);
    assert.match(human.stdout, /one/);
    const rpc: any = await f.rpc(a, [argv]);
    assert.equal(rpc[0].result.id, "one");
    assert.equal(deletes, 2);
  });
test("S17 human specification fields", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(base + "formats/upload-specs/raw", () =>
      HttpResponse.json({
        format: "raw",
        multipleUpload: true,
        componentFields: [{ name: "directory", optional: false }],
        assetFields: [{ name: "filename", optional: true }],
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
  const argv = ["formats", "upload-specs", "get", "raw", "--profile", "lab"];
  const r = await f.run(a, argv);
  assert.equal(r.exitCode, 0);
  assert.match(r.stdout, /directory: required/);
  assert.match(r.stdout, /filename: optional/);
  const rpc: any = await f.rpc(a, [argv]);
  assert.equal(rpc[0].result.multipleUpload, true);
});
for (const kind of ["assets", "components"])
  for (const scenario of ["wrongRecord", "unexpectedStatus"])
    test(`${kind} refuses ${scenario}`, async (t) => {
      let deletes = 0;
      const { fixture: f, app: a } = await offlineCli(
        t,
        http.get(base + kind + "/one", () =>
          HttpResponse.json({
            id: scenario === "wrongRecord" ? "other" : "one",
            assets: [],
          }),
        ),
        http.delete(base + kind + "/one", () => {
          deletes++;
          return new HttpResponse(null, { status: 200 });
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
      await f.run(a, ["permissions", "grant", "Update", "--profile", "lab"]);
      const r = await f.run(a, [
        kind,
        "delete",
        "one",
        "--confirm-id",
        "one",
        "--profile",
        "lab",
        "--json",
      ]);
      assert.equal(r.exitCode, 1);
      assert.equal(r.stdout, "");
      assert.equal(deletes, scenario === "wrongRecord" ? 0 : 1);
    });
