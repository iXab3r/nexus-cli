import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { writeFile, readFile, stat, chmod } from "node:fs/promises";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";

for (const action of ["export", "revoke"]) test(`#677 NuGet ${action} is self-service, protected and RPC safe`, async t => {
  let tickets = 0, keys = 0;
  const ticket = "SYNTHETIC_TICKET";
  const apiKey = "SYNTHETIC_API_KEY";
  const credentials = { username: "owned-publisher", password: 'SYNTHETIC_"PASSWORD' };
  const { fixture: f, app } = await offlineCli(t,
    http.post("https://nexus.example.test/service/extdirect", async ({ request }) => {
      tickets++;
      assert.equal(request.headers.get("authorization"), "Basic " + Buffer.from(credentials.username + ":" + credentials.password).toString("base64"));
      assert.equal(request.headers.get("NX-ANTI-CSRF-TOKEN"), request.headers.get("cookie")?.split("=")[1]);
      assert.deepEqual(await request.json(), { action: "rapture_Security", method: "authenticationToken", data: [Buffer.from(credentials.username).toString("base64"), Buffer.from(credentials.password).toString("base64")], type: "rpc", tid: 1 });
      return HttpResponse.json({ type: "rpc", tid: 1, action: "rapture_Security", method: "authenticationToken", result: ticket });
    }),
    http[ action === "export" ? "get" : "delete" ]("https://nexus.example.test/service/rest/internal/nuget-api-key", ({ request }) => {
      keys++;
      assert.equal(new URL(request.url).searchParams.get("authToken"), Buffer.from(ticket).toString("base64"));
      return HttpResponse.json({ apiKey });
    }));
  await f.run(app, ["profile", "configure", "observer", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  const file = join(f.root, "credentials.json"), output = join(f.root, "key.json");
  await writeFile(file, JSON.stringify(credentials), { mode: 0o600 });
  const argv = ["security", "nuget-api-key", action, "--user-id", credentials.username, "--credentials-file", file, "--profile", "observer", ...(action === "export" ? ["--output", output] : [])];
  const denied = await f.run(app, [...argv, "--json"]);
  assert.equal(JSON.parse(denied.stderr).error.code, "permission.denied");
  assert.equal(tickets, 0);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "observer"]);
  await chmod(file, 0o644);
  const unsafe = await f.run(app, [...argv, "--json"]);
  assert.equal(JSON.parse(unsafe.stderr).error.code, "nexus.input.unsafe");
  assert.equal(tickets, 0);
  await chmod(file, 0o600);
  const rows: any = await f.rpc(app, [argv, ["security", "nuget-api-key", action, "--credentials-stdin", "--user-id", credentials.username]]);
  assert.ok(rows[0].result, JSON.stringify(rows));
  assert.equal(rows[1].error.data.code, "usage");
  assert.equal(keys, 1);
  const receipt = rows[0].result;
  assert.equal(receipt.userId, credentials.username);
  assert.doesNotMatch(JSON.stringify(rows), /SYNTHETIC_|apiKey/);
  if (action === "export") {
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), { userId: credentials.username, apiKey });
    assert.equal((await stat(output)).mode & 0o077, 0);
    const duplicate = await f.run(app, [...argv, "--json"]);
    assert.notEqual(duplicate.exitCode, 0);
    assert.equal(keys, 1);
  } else assert.deepEqual(receipt, { userId: credentials.username, oldKeyRevoked: true, replacementCreated: true });
});

for (const failure of ["401", "403", "404", "redirect", "malformed", "oversized", "ticket-mismatch"]) test(`#677 NuGet refusal ${failure} never exposes credentials`, async t => {
  const secret = 'SYNTHETIC_"PRIVATE';
  let keyCalls = 0;
  const { fixture: f, app } = await offlineCli(t,
    http.post("https://nexus.example.test/service/extdirect", () => HttpResponse.json({ type: "rpc", tid: failure === "ticket-mismatch" ? 2 : 1, action: "rapture_Security", method: "authenticationToken", result: secret })),
    http.delete("https://nexus.example.test/service/rest/internal/nuget-api-key", () => {
      keyCalls++;
      if (failure === "redirect") return new HttpResponse(null, { status: 302, headers: { location: "https://foreign.example.test/?token=" + encodeURIComponent(secret) } });
      if (failure === "malformed") return new HttpResponse('{"apiKey":"' + secret);
      if (failure === "oversized") return HttpResponse.json({ apiKey: secret.repeat(10000) });
      return new HttpResponse(secret, { status: Number(failure) });
    }));
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "credentials.json"); await writeFile(file, JSON.stringify({ username: "owned", password: secret }), { mode: 0o600 });
  const argv = ["security", "nuget-api-key", "revoke", "--user-id", "owned", "--credentials-file", file, "--profile", "lab", "--verbose"];
  const r = await f.run(app, [...argv, "--json"]);
  assert.notEqual(r.exitCode, 0); assert.doesNotMatch(r.stdout + r.stderr, /PRIVATE|foreign.example.test/);
  assert.equal(keyCalls, failure === "ticket-mismatch" ? 0 : 1);
});

test("#677 key principal mismatch fails before reauthentication", async t => {
  const { fixture: f, app } = await offlineCli(t);
  await f.run(app, ["profile", "configure", "lab", "--url", "https://nexus.example.test", "--auth-mode", "anonymous"]);
  await f.run(app, ["permissions", "grant", "Update", "--profile", "lab"]);
  const file = join(f.root, "credentials.json"); await writeFile(file, JSON.stringify({ username: "another", password: "SYNTHETIC_PASSWORD" }), { mode: 0o600 });
  const r = await f.run(app, ["security", "nuget-api-key", "revoke", "--user-id", "owned", "--credentials-file", file, "--profile", "lab", "--json"]);
  assert.equal(JSON.parse(r.stderr).error.code, "usage.invalid");
});

test("#677 key handoff isolates profiles and never reuses observer credentials", async t => {
  const headers: string[] = [], installs: string[] = [], csrf: string[] = [];
  const owned = { username: "owned", password: "SYNTHETIC_OWNED_PASSWORD" };
  const { fixture: f, app } = await offlineCli(t,
    http.get("https://:installation.example.test/context/service/rest/v1/repositories", () => HttpResponse.json([])),
    http.post("https://:installation.example.test/context/service/extdirect", ({ request }) => {
      headers.push(request.headers.get("authorization")!); installs.push(new URL(request.url).host); csrf.push(request.headers.get("NX-ANTI-CSRF-TOKEN")!);
      return HttpResponse.json({ type: "rpc", tid: 1, action: "rapture_Security", method: "authenticationToken", result: "SYNTHETIC_TICKET" });
    }),
    http.delete("https://:installation.example.test/context/service/rest/internal/nuget-api-key", () => HttpResponse.json({ apiKey: "SYNTHETIC_REPLACEMENT" })));
  const path = join(f.root, "owned.json"); await writeFile(path, JSON.stringify(owned), { mode: 0o600 });
  for (const installation of ["a", "b"]) {
    const configured = await f.run(app, ["profile", "configure", installation, "--url", `https://${installation}.example.test/context`, "--auth-mode", "basic", "--credentials-stdin"], { input: Readable.from([JSON.stringify({ username: "observer-" + installation, password: "SYNTHETIC_OBSERVER_PASSWORD" })]) });
    assert.equal(configured.exitCode, 0, configured.stderr);
    await f.run(app, ["permissions", "grant", "Update", "--profile", installation]);
    const result = await f.run(app, ["security", "nuget-api-key", "revoke", "--user-id", "owned", "--credentials-file", path, "--profile", installation, "--json"]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_/);
  }
  assert.deepEqual(installs, ["a.example.test", "b.example.test"]);
  assert.equal(headers[0], "Basic " + Buffer.from(owned.username + ":" + owned.password).toString("base64"));
  assert.equal(headers[0], headers[1]); assert.notEqual(csrf[0], csrf[1]);
});
