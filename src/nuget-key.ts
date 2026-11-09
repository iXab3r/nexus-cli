import { randomBytes } from "node:crypto";
import { lstat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { CliError, HttpError, command, Permission, recordView, readResponseBody, diagnosticCause, saveFile, type CommandContext } from "@eyeauras/cli-factory";
import { inputDocument } from "./administration-input.js";
import { authorization } from "./client.js";

function invalid(message = "Supply the requested user's username/password JSON file."): never {
  throw new CliError(message, { code: "usage.invalid", exitCode: 2 });
}
/** Deliberately narrow 3.97.0-13 internal UI protocol; no profile-secret reuse. */
export const nugetKeyCommand = command("nuget-api-key", "Manage your NuGet publication key", ["export", "revoke"].map(action => command(action, action === "export" ? "Export your NuGet publication key" : "Revoke your previous NuGet key", async ({ options }, c) => {
  const pair: any = await inputDocument(c, options.credentialsFile, true);
  if (!pair || typeof pair !== "object" || Array.isArray(pair) || Object.keys(pair).sort().join(",") !== "password,username" ||
      typeof pair.username !== "string" || !pair.username || /[:\x00-\x1f\x7f]/.test(pair.username) ||
      typeof pair.password !== "string" || /[\x00-\x1f\x7f]/.test(pair.password) || pair.username !== options.userId) invalid();
  const output = action === "export" ? resolve(c.cwd, String(options.output)) : undefined;
  if (output) {
    try { await lstat(output); throw new CliError("Key output already exists.", { code: "nexus.key.outputExists" }); }
    catch (cause) {
      if (cause instanceof CliError) throw cause;
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw new CliError("Could not inspect key output.", { code: "nexus.key.outputFailed" });
    }
  }
  const raw = JSON.stringify(pair), basic = authorization(raw);
  const csrf = randomBytes(32).toString("hex");
  const secrets = [raw, pair.username, pair.password, basic, basic.slice(6), csrf, Buffer.from(pair.password).toString("base64"), Buffer.from(pair.username).toString("base64")];
  const headers = { Accept: "application/json", Authorization: basic, "Content-Type": "application/json", "NX-ANTI-CSRF-TOKEN": csrf, Cookie: "NX-ANTI-CSRF-TOKEN=" + csrf };
  const base = String(c.profile.values.url).replace(/\/$/, "");
  const reply = await internalJson(c, base + "/service/extdirect", "POST", headers, secrets, JSON.stringify({ action: "rapture_Security", method: "authenticationToken", data: [Buffer.from(pair.username).toString("base64"), Buffer.from(pair.password).toString("base64")], type: "rpc", tid: 1 }));
  if (!reply || reply.type !== "rpc" || reply.tid !== 1 || reply.action !== "rapture_Security" || reply.method !== "authenticationToken" || typeof reply.result !== "string" || !reply.result) {
    throw new CliError("Nexus reauthentication did not return a ticket.", { code: "nexus.key.reauthenticationFailed" });
  }
  const ticket = Buffer.from(reply.result).toString("base64");
  secrets.push(reply.result, ticket);
  const url = base + "/service/rest/internal/nuget-api-key?" + new URLSearchParams({ authToken: ticket });
  const key = await internalJson(c, url, action === "export" ? "GET" : "DELETE", headers, secrets, undefined, true);
  if (!key || typeof key.apiKey !== "string" || !key.apiKey) throw new CliError("Nexus key response was invalid; key state may have changed.", { code: "nexus.key.decodeFailed" });
  secrets.push(key.apiKey);
  if (action === "revoke") {
    // DELETE resets: old key is invalid, an unexported replacement now exists.
    key.apiKey = undefined;
    return { userId: pair.username, oldKeyRevoked: true, replacementCreated: true };
  }
  try {
    const saved = await saveFile({ cwd: c.cwd, name: basename(output!), output, content: JSON.stringify({ userId: pair.username, apiKey: key.apiKey }), signal: c.signal });
    key.apiKey = undefined;
    return { userId: pair.username, exported: true, output: saved.path };
  } catch (cause) {
    throw new CliError("Could not publish the key file; the remote key may exist.", { code: "nexus.key.outputFailed", cause: diagnosticCause(cause, secrets) });
  }
}, { permission: Permission.Update, options: [
  { flags: "--user-id <id>", description: "Select your exact user ID", required: true },
  { flags: "--credentials-file <json>", description: "Read your protected Basic credential file", required: true },
  ...(action === "export" ? [{ flags: "--output <file>", description: "Create a protected key file", required: true }] : []),
], view: recordView<any>({ fields: [
  { label: "User", value: r => r.userId }, { label: "Output", value: r => r.output },
  { label: "Previous key revoked", value: r => r.oldKeyRevoked }, { label: "Replacement created", value: r => r.replacementCreated },
] }) })));

async function internalJson(c: CommandContext, url: string, method: string, headers: Record<string, string>, secrets: string[], body?: string, keyOperation = false): Promise<any> {
  let response: Response;
  try { response = await c.fetch(url, { method, headers, body, signal: c.signal, redirect: "manual" }); }
  catch (cause) {
    throw new CliError(keyOperation ? "NuGet key operation outcome is unknown." : "Nexus reauthentication request failed.", { code: keyOperation ? "nexus.key.outcomeUnknown" : "nexus.key.requestFailed", cause: diagnosticCause(cause, [...secrets, url]) });
  }
  if (response.status >= 300 && response.status < 400) {
    void response.body?.cancel();
    throw new CliError("Nexus redirected the key protocol request.", { code: "nexus.key.redirect" });
  }
  if (response.status !== 200) {
    void response.body?.cancel();
    throw new HttpError(response.status, keyOperation ? (response.status >= 500 ? "Nexus key operation failed; key state may have changed." : "Nexus refused the NuGet key operation.") : "Nexus refused reauthentication.");
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await readResponseBody(response, { maxBytes: 65536, signal: c.signal }));
    return JSON.parse(text);
  } catch (cause) {
    // A parser error can quote a not-yet-acquired key. Never retain its raw message.
    throw new CliError(keyOperation ? "Nexus key response could not be decoded; key state may have changed." : "Nexus reauthentication response could not be decoded.", { code: "nexus.key.decodeFailed", cause: diagnosticCause(cause, [...secrets, url], "Invalid or incomplete Nexus response.") });
  }
}
