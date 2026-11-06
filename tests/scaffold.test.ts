import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { offlineCli } from "./offline.js";

test("real command tree exposes help and package version", async t => {
  const { fixture, app } = await offlineCli(t);
  const help = await fixture.run(app, ["--help"]);
  assert.equal(help.exitCode, 0);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /Usage: nexus-cli/);
  const metadata = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const version = await fixture.run(app, ["--version"]);
  assert.equal(version.exitCode, 0);
  assert.equal(version.stdout.trim(), metadata.version);
  const missing = await fixture.run(app, ["repositories", "list"]);
  assert.notEqual(missing.exitCode, 0);
});

test("offline harness intercepts native fetch and rejects unhandled requests", async t => {
  await offlineCli(t, http.get("https://nexus.example.test/probe", () => HttpResponse.json({ ok: true })));
  assert.deepEqual(await (await fetch("https://nexus.example.test/probe")).json(), { ok: true });
  await assert.rejects(fetch("https://nexus.example.test/unhandled"));
});
