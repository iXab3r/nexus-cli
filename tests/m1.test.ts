import assert from "node:assert/strict";
import test from "node:test";
import { Readable, PassThrough } from "node:stream";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";
const url = "https://nexus.example.test:443/context";
const pair = JSON.stringify({
  username: "synthetic-reader",
  password: "synthetic-password",
});
async function configure(f: any, a: any, name = "lab", anonymous = false) {
  return f.run(
    a,
    [
      "profile",
      "configure",
      name,
      "--url",
      url,
      ...(anonymous ? ["--auth-mode", "anonymous"] : ["--credentials-stdin"]),
      "--json",
    ],
    { input: Readable.from([pair]) },
  );
}
test("S01 validates and stores a pair; S03 status separates access from identity and logout is local", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories",
      () => HttpResponse.json([]),
    ),
  );
  assert.equal((await configure(f, a)).exitCode, 0);
  const profile: any = await f.json(a, ["profile", "show", "lab"]);
  assert.ok(JSON.stringify(profile).includes(":443/context"));
  assert.ok(!JSON.stringify(profile).includes("synthetic-password"));
  const status: any = await f.json(a, ["auth", "status", "--profile", "lab"]);
  assert.equal(status.identity.state, "storedUnverified");
  assert.equal(status.identity.probe, "accessObserved");
  assert.equal(
    (await f.run(a, ["auth", "logout", "--profile", "lab"])).exitCode,
    0,
  );
  const absent: any = await f.json(a, ["auth", "status", "--profile", "lab"]);
  assert.equal(absent.identity.state, "absent");
});
test("S01 malformed and missing credentials fail before service calls", async (t) => {
  const { fixture: f, app: a } = await offlineCli(t);
  for (const input of [
    "bad",
    JSON.stringify({ username: "bad:name", password: "x" }),
  ]) {
    const r = await f.run(
      a,
      [
        "profile",
        "configure",
        "lab",
        "--url",
        url,
        "--credentials-stdin",
        "--json",
      ],
      { input: Readable.from([input]) },
    );
    assert.notEqual(r.exitCode, 0);
  }
  assert.notEqual(
    (await f.run(a, ["profile", "configure", "lab", "--url", url, "--json"]))
      .exitCode,
    0,
  );
});
test("S04 anonymous, S06 empty/list output, S07 encoded name and missing resource", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories",
      ({ request }) => {
        assert.equal(request.headers.get("authorization"), null);
        return HttpResponse.json([]);
      },
    ),
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories/:name",
      ({ params }) =>
        params.name === "a/b"
          ? HttpResponse.json({
              name: "a/b",
              format: "raw",
              type: "hosted",
              url: "https://nexus.example.test/repository/a",
              online: true,
            })
          : new HttpResponse(null, { status: 404 }),
    ),
  );
  assert.equal((await configure(f, a, "public", true)).exitCode, 0);
  assert.deepEqual(
    await f.json(a, ["repositories", "list", "--profile", "public"]),
    [],
  );
  assert.match(
    (await f.run(a, ["repositories", "list", "--profile", "public"])).stdout,
    /No visible repositories/,
  );
  const result: any = await f.json(a, [
    "repositories",
    "get",
    "a/b",
    "--profile",
    "public",
  ]);
  assert.equal(result.name, "a/b");
  assert.equal(
    (await f.run(a, ["repositories", "get", "missing", "--profile", "public"]))
      .exitCode,
    1,
  );
});
test("S02 missing profile and S05 source status endpoints", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/status",
      () => new HttpResponse(null, { status: 200 }),
    ),
    http.get(
      "https://nexus.example.test/context/service/rest/v1/status/writable",
      () => new HttpResponse(null, { status: 200 }),
    ),
  );
  assert.notEqual(
    (await f.run(a, ["repositories", "list", "--profile", "missing"])).exitCode,
    0,
  );
  assert.equal((await configure(f, a, "public", true)).exitCode, 0);
  assert.deepEqual(await f.json(a, ["status", "--profile", "public"]), {
    readable: true,
    writable: true,
  });
});
test("S01 rejected preserves prior state; denied remains usable; S02 RPC isolation", async (t) => {
  let mode = 200;
  const observed: string[] = [];
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories",
      ({ request }) => {
        observed.push(request.headers.get("authorization") ?? "anonymous");
        return mode === 200
          ? HttpResponse.json([])
          : new HttpResponse(null, { status: mode });
      },
    ),
  );
  assert.equal((await configure(f, a)).exitCode, 0);
  mode = 401;
  assert.equal((await configure(f, a)).exitCode, 1);
  mode = 403;
  assert.equal((await configure(f, a)).exitCode, 0);
  const denied: any = await f.json(a, ["auth", "status", "--profile", "lab"]);
  assert.equal(denied.identity.probe, "denied");
  assert.equal(denied.identity.ready, true);
  assert.equal(
    (await f.run(a, ["repositories", "list", "--profile", "lab"])).exitCode,
    1,
  );
  mode = 200;
  assert.equal((await configure(f, a, "public", true)).exitCode, 0);
  observed.length = 0;
  const replies: any[] = await f.rpc(a, [
    ["repositories", "list", "--profile", "lab"],
    ["repositories", "list", "--profile", "public"],
    ["repositories", "list", "--profile", "lab"],
  ]);
  assert.equal(replies.length, 3);
  assert.equal(observed.length, 3);
  assert.equal(observed[0], observed[2]);
  assert.equal(observed[1], "anonymous");
  assert.match(observed[0]!, /^Basic /);
  assert.equal(
    (await f.run(a, ["permissions", "revoke", "ReadOnly", "--profile", "lab"]))
      .exitCode,
    0,
  );
  observed.length = 0;
  assert.equal(
    (await f.run(a, ["repositories", "list", "--profile", "lab"])).exitCode,
    1,
  );
  assert.equal(observed.length, 0);
});
test("S04 no Basic fallback; S05 503; S06 failures never dump response bodies", async (t) => {
  let mode = 200;
  let count = 0;
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories",
      () => {
        count++;
        return mode === 200
          ? HttpResponse.json([])
          : new HttpResponse("synthetic-sensitive-response", { status: mode });
      },
    ),
    http.get(
      "https://nexus.example.test/context/service/rest/v1/status",
      () => new HttpResponse(null, { status: 503 }),
    ),
  );
  assert.equal((await configure(f, a)).exitCode, 0);
  for (mode of [401, 403, 500]) {
    count = 0;
    const r = await f.run(a, [
      "repositories",
      "list",
      "--profile",
      "lab",
      "--json",
    ]);
    assert.equal(r.exitCode, 1);
    assert.equal(count, 1);
    assert.equal(r.stdout, "");
    assert.ok(!r.stderr.includes("synthetic-sensitive-response"));
    assert.ok(!r.stderr.includes("synthetic-password"));
  }
  const unavailable = await f.run(a, ["status", "--profile", "lab", "--json"]);
  assert.equal(unavailable.exitCode, 1);
  assert.match(unavailable.stderr, /http.serverError/);
});
test("S01 secure-store failure fails closed; S03 absent status needs no HTTP", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories",
      () => HttpResponse.json([]),
    ),
  );
  f.secretStore.set = async () => {
    throw new Error("Synthetic secure store unavailable");
  };
  const result = await configure(f, a);
  assert.equal(result.exitCode, 1);
  assert.ok(!result.stderr.includes("synthetic-password"));
  const status: any = await f.json(a, ["auth", "status"]);
  assert.equal(status.identity.state, "absent");
  assert.equal(status.identity.probe, "notRun");
});
test("S01 redirect preserves saved port/context and scopes Basic", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "http://nexus.example.test:8081/context/service/rest/v1/repositories",
      () =>
        HttpResponse.redirect(
          "https://nexus.example.test:8443/context/service/rest/v1/repositories",
        ),
    ),
    http.get(
      "https://nexus.example.test:8443/context/service/rest/v1/repositories",
      ({ request }) => {
        assert.match(request.headers.get("authorization") ?? "", /^Basic /);
        return HttpResponse.redirect("https://content.example.test/list");
      },
    ),
    http.get("https://content.example.test/list", ({ request }) => {
      assert.equal(request.headers.get("authorization"), null);
      return HttpResponse.json([]);
    }),
  );
  const result = await f.run(
    a,
    [
      "profile",
      "configure",
      "lab",
      "--url",
      "http://nexus.example.test:8081/context",
      "--credentials-stdin",
      "--json",
    ],
    { input: Readable.from([pair]) },
  );
  assert.equal(result.exitCode, 0);
  assert.match(
    JSON.stringify(await f.json(a, ["profile", "show", "lab"])),
    /http:\/\/nexus.example.test:8081\/context/,
  );
});

test("S02 alternating RPC profiles keep distinct endpoints and Basic pairs", async (t) => {
  const seen: string[] = [];
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://:host.example.test/service/rest/v1/repositories",
      ({ request, params }) => {
        const host = String(params.host);
        seen.push(host);
        assert.equal(
          request.headers.get("authorization"),
          "Basic " +
            Buffer.from(host + ":synthetic-" + host).toString("base64"),
        );
        return HttpResponse.json([
          {
            name: host,
            format: "raw",
            type: "hosted",
            url: "https://" + host + ".example.test/repository/" + host,
          },
        ]);
      },
    ),
  );
  for (const name of ["alpha", "beta"])
    assert.equal(
      (
        await f.run(
          a,
          [
            "profile",
            "configure",
            name,
            "--url",
            "https://" + name + ".example.test",
            "--credentials-stdin",
            "--json",
          ],
          {
            input: Readable.from([
              JSON.stringify({ username: name, password: "synthetic-" + name }),
            ]),
          },
        )
      ).exitCode,
      0,
    );
  seen.length = 0;
  const replies: any[] = await f.rpc(a, [
    ["repositories", "list", "--profile", "alpha"],
    ["repositories", "list", "--profile", "beta"],
    ["repositories", "list", "--profile", "alpha"],
  ]);
  assert.deepEqual(seen, ["alpha", "beta", "alpha"]);
  for (const r of replies) assert.ok(!r.error);
});

test("S01 password whitespace is preserved; denied list does not prevent narrow detail", async (t) => {
  const password = "  synthetic password  ";
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories",
      ({ request }) => {
        assert.equal(
          request.headers.get("authorization"),
          "Basic " + Buffer.from("reader:" + password).toString("base64"),
        );
        return new HttpResponse(null, { status: 403 });
      },
    ),
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories/releases",
      () =>
        HttpResponse.json({
          name: "releases",
          format: "raw",
          type: "hosted",
          url: "https://nexus.example.test/repository/releases",
        }),
    ),
  );
  const result = await f.run(
    a,
    [
      "profile",
      "configure",
      "lab",
      "--url",
      url,
      "--credentials-stdin",
      "--json",
    ],
    {
      input: Readable.from([JSON.stringify({ username: "reader", password })]),
    },
  );
  assert.equal(result.exitCode, 0);
  assert.match(
    (await f.run(a, ["repositories", "get", "releases", "--profile", "lab"]))
      .stdout,
    /releases/,
  );
});

test("S06 malformed body and S07 RPC absence preserve safe error channels", async (t) => {
  const { fixture: f, app: a } = await offlineCli(
    t,
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories",
      () => new HttpResponse("synthetic-sensitive-invalid-json"),
    ),
    http.get(
      "https://nexus.example.test/context/service/rest/v1/repositories/missing",
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
  assert.equal((await configure(f, a, "public", true)).exitCode, 0);
  const malformed = await f.run(a, [
    "repositories",
    "list",
    "--profile",
    "public",
    "--json",
  ]);
  assert.equal(malformed.exitCode, 1);
  assert.equal(malformed.stdout, "");
  assert.ok(!malformed.stderr.includes("synthetic-sensitive-invalid-json"));
  const [reply]: any[] = await f.rpc(a, [
    ["repositories", "get", "missing", "--profile", "public"],
  ]);
  assert.equal(reply.error.data.code, "http.notFound");
  assert.equal(reply.error.data.exitCode, 1);
});


test("S01 oversized credential stdin fails before HTTP or persistence", async (t) => {
  const { fixture: f, app: a, server } = await offlineCli(t);
  let calls = 0;
  server.events.on("request:start", () => { calls++; });
  const before = JSON.stringify(await f.profileStore.list());
  const result = await f.run(a, ["profile", "configure", "lab", "--url", url, "--credentials-stdin", "--json"], {
    input: Readable.from([JSON.stringify({username: "synthetic", password: "x".repeat(65536)})]),
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /64 KiB/);
  assert.equal(JSON.stringify(await f.profileStore.list()), before);
    assert.equal(calls, 0);
});

test("S01 cancellation stops credential stdin before EOF without persistence", async (t) => {
  const { fixture: f, app: a, server } = await offlineCli(t);
  let calls = 0;
  server.events.on("request:start", () => { calls++; });
  const input = new PassThrough();
  const controller = new AbortController();
  const before = JSON.stringify(await f.profileStore.list());
  input.once("resume", () => controller.abort());
  const pending = f.run(a, ["profile", "configure", "lab", "--url", url, "--credentials-stdin", "--json"], {input, signal: controller.signal});
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Cancellation did not settle while stdin remained open")), 500);
    })]);
    assert.notEqual(result.exitCode, 0);
    assert.equal(JSON.stringify(await f.profileStore.list()), before);
    assert.equal(calls, 0);
    assert.equal(input.listenerCount("data"), 0);
  } finally {
    clearTimeout(timer);
    input.end();
    await pending;
  }
});
