import {
  CliError,
  HttpError,
  diagnosticCause,
  type AuthDefinition,
  type CommandContext,
} from "@eyeauras/cli-factory";
import type { Readable } from "node:stream";
import { request } from "./client.js";

/** Read at most 64 KiB of credential JSON; cancellation must not wait for EOF. */
async function readCredentials(input: Readable, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      input.pause();
      input.off("data", onData);
      input.off("end", onEnd);
      input.off("error", onError);
      input.off("close", onClose);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(Buffer.concat(chunks, bytes).toString("utf8"));
    };
    const onData = (chunk: Buffer | string) => {
      const length = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (length > 65536 - bytes) {
        finish(new CliError("Credential JSON must not exceed 64 KiB.", {code: "usage.invalid", exitCode: 2}));
        return;
      }
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      bytes += length;
    };
    const onEnd = () => finish();
    const onError = () => finish(new CliError("Could not read credential input.", {code: "auth.inputFailed"}));
    const onClose = () => finish(new CliError("Credential input closed before completion.", {code: "auth.inputFailed"}));
    const onAbort = () => finish(new DOMException("Credential input cancelled.", "AbortError"));
    input.on("end", onEnd);
    input.on("error", onError);
    input.on("close", onClose);
    signal.addEventListener("abort", onAbort, {once: true});
    input.on("data", onData);
    if (signal.aborted) onAbort();
  });
}

async function probe(context: CommandContext, raw?: string) {
  try {
    const r = await request(context, "repositories", raw);
    void r.body?.cancel();
    return r.status === 401
      ? "rejected"
      : r.status === 403
        ? "denied"
        : r.status === 200
          ? "accessObserved"
          : "unavailable";
  } catch {
    return "unavailable";
  }
}
/** Core's authenticated login flag admits persistence; it never proves Nexus identity. */
export const nexusAuth: AuthDefinition = {
  isReady: async (c) =>
    c.profile.values.authMode === "anonymous" ||
    !!(await c.secrets.get("credentials")),
  loginOptions: [
    {
      flags: "--credentials-stdin",
      description: "Read a Basic credential pair as JSON",
    },
  ],
  async login(c, options) {
    if (c.profile.values.authMode === "anonymous") {
      if (options.credentialsStdin)
        throw new CliError("Choose anonymous mode or a credential pair.", {
          code: "usage.invalid",
          exitCode: 2,
        });
      await c.secrets.delete("credentials");
      return {
        authenticated: true,
        identity: {
          state: "anonymousConfigured",
          probe: "notRun",
          url: c.profile.values.url,
        },
      };
    }
    if (!options.credentialsStdin)
      throw new CliError("Provide a Basic credential pair on stdin.", {
        code: "auth.missingCredentials",
        next: [["profile", "configure", c.profile.name, "--credentials-stdin"]],
      });
    if (!c.stdinAvailable)
      throw new CliError(
        "Credential stdin is unavailable through this transport.",
        { code: "usage.invalid", exitCode: 2 },
      );
    const raw = await readCredentials(c.io.input, c.signal);
    let pair: unknown;
    try {
      pair = JSON.parse(raw);
    } catch {
      throw new CliError("Credentials must be a JSON username/password pair.", {
        code: "usage.invalid",
        exitCode: 2,
      });
    }
    const p = pair as Record<string, unknown>;
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.username !== "string" ||
      !p.username ||
      /[:\x00-\x1f\x7f]/.test(p.username) ||
      typeof p.password !== "string" ||
      /[\x00-\x1f\x7f]/.test(p.password) ||
      Object.keys(p).some((k) => k !== "username" && k !== "password")
    )
      throw new CliError(
        "Credentials require a username and password without controls.",
        { code: "usage.invalid", exitCode: 2 },
      );

    const outcome = await probe(c, raw);
    if (outcome === "rejected")
      throw new HttpError(
        401,
        "Nexus rejected the credential probe. Nothing was saved.",
      );
    c.signal.throwIfAborted();
    try {
      await c.secrets.set("credentials", raw);
    } catch (cause) {
      throw new CliError("Could not save credentials in secure storage.", {
        code: "auth.storeFailed",
        cause: diagnosticCause(cause, [raw, p.password]),
      });
    }
    return {
      authenticated: true,
      identity: {
        state: "storedUnverified",
        probe: outcome,
        url: c.profile.values.url,
      },
    };
  },
  async status(c) {
    const anonymous = c.profile.values.authMode === "anonymous";
    const raw = anonymous ? undefined : await c.secrets.get("credentials");
    return {
      authenticated: false,
      identity: {
        state: anonymous
          ? "anonymousConfigured"
          : raw
            ? "storedUnverified"
            : "absent",
        ready: anonymous || !!raw,
        probe: anonymous || raw ? await probe(c, raw) : "notRun",
      },
    };
  },
  async logout(c) {
    await c.secrets.delete("credentials");
  },
};
