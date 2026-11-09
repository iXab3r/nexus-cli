import assert from "node:assert/strict";
import test from "node:test";
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
