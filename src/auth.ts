import {
  CliError,
  HttpError,
  diagnosticCause,
  type AuthDefinition,
  type CommandContext,
} from "@eyeauras/cli-factory";
import { text } from "node:stream/consumers";
import { request } from "./client.js";
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
    const raw = await text(c.io.input);
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
