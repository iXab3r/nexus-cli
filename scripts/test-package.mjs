import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await mkdtemp(join(tmpdir(), "nexus-package-"));
const prefix = join(temp, "prefix");
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run with npm run test:package.");
function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: temp, encoding: "utf8", timeout: 180000, ...options });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
try {
  const metadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const [packed] = JSON.parse(run(process.execPath, [npmCli, "pack", "--json", "--ignore-scripts", "--pack-destination", temp], { cwd: root }));
  assert.deepEqual(packed.files.map(f => f.path).sort(), ["README.md", "dist/src/bin.js", "dist/src/cli.js", "package.json"]);
  console.log("Archive allowlist passed (4 files). Installing dependencies; this phase may use npm network access.");
  run(process.execPath, [npmCli, "install", "--global", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", join(temp, packed.filename)]);
  const guard = join(temp, "offline.cjs");
  await writeFile(guard, 'const net = require("node:net"); net.Socket.prototype.connect = function () { throw new Error("Network disabled in package smoke"); }; globalThis.fetch = async () => { throw new Error("Network disabled in package smoke"); };');
  const home = join(temp, "home");
  await mkdir(home);
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: home, USERPROFILE: home, APPDATA: home, XDG_CONFIG_HOME: home, NODE_OPTIONS: "--require " + JSON.stringify(guard) };
  const windows = process.platform === "win32";
  const executable = join(prefix, windows ? "nexus-cli.cmd" : "bin/nexus-cli");
  const invoke = args => windows
    ? run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", '"' + executable + '" ' + args.join(" ")], { env })
    : run(executable, args, { env });
  assert.match(invoke(["--help"]), /Usage: nexus-cli/);
  assert.equal(invoke(["--version"]).trim(), metadata.version);
  console.log("Installed executable help/version passed with network blocked and isolated user directories.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
