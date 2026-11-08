import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";

const origin = "https://nexus.example.test";
const routes = [
  { path: "assets/id", argv: ["assets", "get", "id"], assets: true, page: false },
  { path: "components/id", argv: ["components", "get", "id"], assets: false, page: false },
  { path: "assets", argv: ["assets", "list", "--repository", "releases"], assets: true, page: true },
  { path: "components", argv: ["components", "list", "--repository", "releases"], assets: false, page: true },
  { path: "search/assets", argv: ["search", "assets"], assets: true, page: true },
  { path: "search", argv: ["search", "components"], assets: false, page: true },
];
type Route = typeof routes[number];
function itemWire(token: string, assets: boolean) {
  const asset = '{"id":"asset","path":"demo.bin","fileSize":' + token + ',"future":{"fileSize":1.25}}';
  return assets ? asset : '{"id":"component","name":"demo","fileSize":2.5,"assets":[' + asset + '],"extraJsonAttributes":{"fileSize":1.25}}';
}
function responseWire(token: string, route: Route, next: string | null = null) {
  const item = itemWire(token, route.assets);
  return route.page ? '{"items":[' + item + '],"continuationToken":' + JSON.stringify(next) + '}' : item;
}
async function setup(t: TestContext, route: Route, respond: (url: URL) => string) {
  const calls: URL[] = [];
  const cli = await offlineCli(t, http.get(origin + "/service/rest/v1/" + route.path, ({ request }) => {
    const url = new URL(request.url); calls.push(url);
    return new HttpResponse(respond(url), { headers: { "content-type": "application/json" } });
  }));
  assert.equal((await cli.fixture.run(cli.app, ["profile", "configure", "lab", "--url", origin, "--auth-mode", "anonymous"])).exitCode, 0);
  return { ...cli, calls };
}
function selected(result: any, route: Route) {
  const item = route.page ? result.items[0] : result;
  return route.assets ? item : item.assets[0];
}

for (const route of routes) for (const [token, expected] of [
  ["9007199254740991", Number.MAX_SAFE_INTEGER],
  ["9007199254740993", "9007199254740993"],
  ["9223372036854775807", "9223372036854775807"],
  ["-9223372036854775808", "-9223372036854775808"],
] as const) test(`Q2 ${route.path} retains exact size ${token} in every mode`, async t => {
  const cli = await setup(t, route, () => responseWire(token, route));
  const argv = [...route.argv, "--profile", "lab"];
  const result: any = await cli.fixture.json(cli.app, argv);
  assert.equal(selected(result, route).fileSize, expected);
  assert.deepEqual(selected(result, route).future, { fileSize: 1.25 });
  const root = route.page ? result.items[0] : result;
  if (!route.assets) { assert.equal(root.fileSize, 2.5); assert.deepEqual(root.extraJsonAttributes, { fileSize: 1.25 }); }
  const rpc: any = (await cli.fixture.rpc(cli.app, [argv]))[0];
  assert.equal(selected(rpc.result, route).fileSize, expected);
  const human = await cli.fixture.run(cli.app, argv);
  assert.equal(human.exitCode, 0, human.stderr);
  assert.ok(human.stdout.includes(String(expected)), human.stdout);
  assert.equal(cli.calls.length, 3);
});

for (const [token, expected] of [
  ["0", 0], ["-0", 0], ["0e99999999999999999999", 0], ["1.50e1", 15], ["1000e-3", 1],
  ["9.007199254740993e15", "9007199254740993"], ["9007199254740993.000", "9007199254740993"],
  ["92233720368547758070e-1", "9223372036854775807"], ["-9.223372036854775808e18", "-9223372036854775808"],
  ["1e+18", "1000000000000000000"], ["-9007199254740991", -Number.MAX_SAFE_INTEGER],
] as const) test(`Q2 native integer spelling ${token} remains exact`, async t => {
  const route = routes[0];
  const cli = await setup(t, route, () => responseWire(token, route));
  const r: any = await cli.fixture.json(cli.app, [...route.argv, "--profile", "lab"]);
  assert.equal(r.fileSize, expected);
});

for (const route of routes) test(`Q2 ${route.path} rejects invalid sizes without false results`, async t => {
  let token = "null";
  const cli = await setup(t, route, () => responseWire(token, route));
  for (const value of ["null", '"9007199254740993"', "true", "{}", "1.25", "9007199254740991.000000000000000001", "1e-99999999999999999999",
    "9223372036854775808", "-9223372036854775809", "1e99999999999999999999", "00", "NaN"]) {
    token = value;
    const argv = [...route.argv, "--profile", "lab"];
    const r = await cli.fixture.run(cli.app, [...argv, "--json"]);
    assert.equal(r.exitCode, 1, value);
    const error = JSON.parse(r.stderr).error;
    assert.equal(error.code, route.page ? "nexus.pagination.decodeFailed" : "nexus.decodeFailed");
    if (route.page) {
      const data = JSON.parse(r.stdout);
      assert.deepEqual(data.items, []);
      assert.deepEqual(data.resume, { restart: true, token: null });
    } else assert.equal(r.stdout, "");
    const rpc: any = (await cli.fixture.rpc(cli.app, [argv]))[0];
    assert.equal(rpc.error.data.code, error.code);
  }
});

for (const route of routes.filter(r => r.page)) test(`Q2 ${route.path} numeric failure rejects page two and retains its input checkpoint`, async t => {
  const cli = await setup(t, route, url => url.searchParams.has("continuationToken")
    ? responseWire("9223372036854775808", route) : responseWire("9007199254740993", route, "opaque+/="));
  const argv = [...route.argv, "--all", "--profile", "lab"];
  const r = await cli.fixture.run(cli.app, [...argv, "--json"]);
  assert.equal(r.exitCode, 1);
  const result = JSON.parse(r.stdout);
  assert.equal(selected(result, route).fileSize, "9007199254740993");
  assert.equal(result.pagesFetched, 1);
  assert.deepEqual(result.resume, { restart: false, token: "opaque+/=" });
  assert.equal(JSON.parse(r.stderr).error.code, "nexus.pagination.decodeFailed");
  const rpc: any = (await cli.fixture.rpc(cli.app, [argv]))[0];
  assert.deepEqual(rpc.error.data.result, result);
});

test("Q2 absent optional sizes stay absent and numeric-token work is bounded", async t => {
  const route = routes[0];
  let response = '{"id":"asset","future":{"fileSize":1.25}}';
  const cli = await setup(t, route, () => response);
  const argv = [...route.argv, "--profile", "lab"];
  assert.deepEqual(await cli.fixture.json(cli.app, argv), { id: "asset", future: { fileSize: 1.25 } });
  response = responseWire("1" + "0".repeat(10000) + "e-10000", route);
  assert.equal((await cli.fixture.json(cli.app, argv) as any).fileSize, 1);
  response = responseWire("1e" + "9".repeat(10000), route);
  const r = await cli.fixture.run(cli.app, [...argv, "--json"]);
  assert.equal(r.exitCode, 1);
  assert.equal(r.stdout, "");
  assert.ok(r.stderr.length < 4000);
});

test("Q2 newly visible nested page metadata escapes terminal controls", async t => {
  const route = routes[3];
  const cli = await setup(t, route, () => responseWire("9007199254740993", route).replace("demo.bin", "demo\\u001b[31m.bin"));
  const argv = [...route.argv, "--profile", "lab"];
  const r = await cli.fixture.run(cli.app, argv);
  assert.equal(r.exitCode, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /\u001b/);
  assert.match(r.stdout, /\\u001b/);
  assert.equal(selected(await cli.fixture.json(cli.app, argv), route).path, "demo\u001b[31m.bin");
});

test("Q2 unrelated deeply nested metadata preserves the baseline JSON contract", async t => {
  const route = routes[1];
  const depth = 5000;
  const deep = '{"n":'.repeat(depth) + '1' + '}'.repeat(depth);
  const response = '{"id":"component","assets":[{"id":"asset","fileSize":9007199254740993}],"extraJsonAttributes":' + deep + '}';
  // The native baseline parser/serializer admit this 30KB document.
  assert.ok(JSON.stringify(JSON.parse(response)).length < 40000);
  const cli = await setup(t, route, () => response);
  const argv = [...route.argv, "--profile", "lab"];
  for (const rpc of [false, true]) {
    const value: any = rpc ? (await cli.fixture.rpc(cli.app, [argv]) as any[])[0].result : await cli.fixture.json(cli.app, argv);
    assert.equal(value.assets[0].fileSize, "9007199254740993");
    let child = value.extraJsonAttributes;
    for (let i = 0; i < depth; i++) child = child.n;
    assert.equal(child, 1);
  }
});

test("Q2 token provenance honors escaped keys, opaque strings and last duplicate containers", async t => {
  const route = routes[1];
  let response = '{"id":"component","assets":[{"id":"old","fileSize":9223372036854775807}],"assets":[{"id":"new","fi\\u006ceSize":9007199254740993,"future":{"fileSize":1.25,"text":"brace } comma , quote \\\" fileSize"}}]}';
  const cli = await setup(t, route, () => response);
  const argv = [...route.argv, "--profile", "lab"];
  const value: any = await cli.fixture.json(cli.app, argv);
  assert.equal(value.assets[0].fileSize, "9007199254740993");
  assert.equal(value.assets[0].future.fileSize, 1.25);
  response = '{"id":"component","assets":[{"id":"old","fileSize":9223372036854775807}],"assets":[{"id":"new"}]}';
  assert.deepEqual((await cli.fixture.json(cli.app, argv) as any).assets, [{ id: "new" }]);
  response = '{"id":"component","assets":[{"id":"new","fileSize":null,"fileSize":1}]}';
  assert.equal((await cli.fixture.json(cli.app, argv) as any).assets[0].fileSize, 1);
});
