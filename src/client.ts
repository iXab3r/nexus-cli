import { readContext, readResource, resourceRedactions, statusMessage } from "./diagnostics.js";
import { parseMetadata } from "./metadata.js";
import {
  CliError,
  HttpError,
  fetchWithRedirects,
  readResponseBody,
  diagnosticCause,
  type CommandContext,
} from "@eyeauras/cli-factory";
/** Credential pairs live only in Core's profile-scoped secret store. */
export function authorization(raw: string): string {
  const pair = JSON.parse(raw) as { username: string; password: string };

  const value =
    "Basic " +
    Buffer.from(pair.username + ":" + pair.password, "utf8").toString("base64");
  return value;
}
/** Encode a literal path segment; dot-navigation segments cannot survive URL normalization. */
export function pathSegment(value: string): string {
  if (value === "." || value === "..") {
    throw new CliError("A resource identifier cannot be '.' or '..'.", {
      code: "usage",
      exitCode: 2,
    });
  }
  return encodeURIComponent(value);
}
/** Read one Nexus REST resource using Core redirect and diagnostic policy. */
export async function request(
  context: CommandContext,
  path: string,
  credential?: string,
): Promise<Response> {
  const raw =
    credential ??
    (context.profile.values.authMode === "anonymous"
      ? undefined
      : await context.secrets.require("credentials"));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (raw) headers.Authorization = authorization(raw);
  const url = String(context.profile.values.url).replace(/\/$/, "") + "/service/rest/v1/" + path;
  try {
    return await fetchWithRedirects(
      context.fetch,
      url,
      { headers, signal: context.signal },
    );
  } catch (cause) {
    throw new CliError(readContext(path) + ": request failed.", {
      code: "nexus.requestFailed",
      cause: diagnosticCause(
        cause,
        [...resourceRedactions(url, readResource(path)), ...(raw ? [raw, JSON.parse(raw).password, headers.Authorization!] : [])],
      ),
    });
  }
}
export async function checked(
  context: CommandContext,
  path: string,
): Promise<Response> {
  const response = await request(context, path);
  if (response.status !== 200) {
    void response.body?.cancel();
    throw new HttpError(response.status, statusMessage(response.status, readContext(path)));
  }
  return response;
}
export interface Repository {
  name: string;
  format: string;
  type: string;
  url: string | null;
  online: boolean | null;
  size?: number | string;
  attributes?: { proxy?: { remoteUrl?: string | null } };
}
/** Nexus URL results expose a location, excluding credential-bearing URL components. */
function repositoryUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.href;
  } catch { return null; }
}
function invalidRepository(): never {
  throw new CliError("Nexus repository response is invalid.", { code: "nexus.decodeFailed" });
}
function repository(value: unknown): Repository {
  const r = value as Record<string, unknown>;
  if (
    !r ||
    typeof r !== "object" ||
    Array.isArray(r) ||
    ["name", "format", "type", "url"].some((k) => typeof r[k] !== "string") ||
    (r.online !== undefined && typeof r.online !== "boolean")
  )
    invalidRepository();
  let attributes: Repository["attributes"];
  if (Object.hasOwn(r, "attributes")) {
    const groups = r.attributes;
    if (!groups || typeof groups !== "object" || Array.isArray(groups) ||
      Object.values(groups).some(group => !group || typeof group !== "object" || Array.isArray(group))) invalidRepository();
    attributes = {};
    if (r.type === "proxy" && Object.hasOwn(groups, "proxy")) {
      const proxy = (groups as Record<string, Record<string, unknown>>).proxy;
      attributes.proxy = {};
      if (Object.hasOwn(proxy, "remoteUrl")) {
        if (proxy.remoteUrl !== null && typeof proxy.remoteUrl !== "string") invalidRepository();
        attributes.proxy.remoteUrl = proxy.remoteUrl === null || proxy.remoteUrl === "" ? proxy.remoteUrl : repositoryUrl(proxy.remoteUrl);
      }
    }
  }
  return {
    name: r.name as string,
    format: r.format as string,
    type: r.type as string,
    url: repositoryUrl(r.url as string),
    online: typeof r.online === "boolean" ? r.online : null,
    ...(Object.hasOwn(r, "size") ? { size: r.size as number | string } : {}),
    ...(attributes === undefined ? {} : { attributes }),
  };
}
export async function repositories(
  context: CommandContext,
  name?: string,
): Promise<Repository[] | Repository> {
  const path = "repositories" + (name === undefined ? "" : "/" + pathSegment(name));
  const response = await checked(context, path);
  let data: unknown;
  try {
    data = parseMetadata(
      Buffer.from(
        await readResponseBody(response, {
          maxBytes: 4 * 1024 * 1024,
          signal: context.signal,
        }),
      ).toString("utf8"), path,
    );
  } catch (cause) {
    throw new CliError(readContext("repositories" + (name === undefined ? "" : "/" + pathSegment(name))) + ": could not decode response.", {
      code: "nexus.decodeFailed",
      cause: diagnosticCause(cause, resourceRedactions(String(context.profile.values.url).replace(/\/$/, "") + "/service/rest/v1/" + path, response.url, name), "Invalid or incomplete JSON response."),
    });
  }
  if (name !== undefined) return repository(data);
  if (!Array.isArray(data) || data.length > 1000)
    throw new CliError(
      "Nexus repository list exceeds its shape or item limit.",
      { code: "nexus.decodeFailed" },
    );
  return data.map(repository);
}
