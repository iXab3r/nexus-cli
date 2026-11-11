import { CliError, command, Permission, readResponseBody, recordView } from "@eyeauras/cli-factory";
import { checked } from "./client.js";
import { validateDto } from "./nexus-dto.js";

// Native HttpSettingsXo/ProxySettingsXo/AuthSettingsXo, pinned 3.97.0-13.
// Auth identities and passwords are deliberately excluded from the observation.
const privateText = { type: "string", nullable: true, writeOnly: true };
const proxySchema = { type: "object", required: ["enabled", "host", "port", "authInfo"], properties: {
  enabled: { type: "boolean" }, host: { type: "string", nullable: true }, port: { type: "string", nullable: true },
  authInfo: { type: "object", required: ["enabled"], properties: {
    enabled: { type: "boolean" }, username: privateText, password: privateText, ntlmHost: privateText, ntlmDomain: privateText,
  } },
} };
const schema = { type: "object", required: ["userAgent", "timeout", "retries", "httpProxy", "httpsProxy"], properties: {
  userAgent: { type: "string", nullable: true },
  timeout: { type: "integer", format: "int32", minimum: 1, maximum: 3600 },
  retries: { type: "integer", format: "int32", minimum: 0, maximum: 10 },
  nonProxyHosts: { type: "array", uniqueItems: true, items: { type: "string" } },
  httpProxy: proxySchema, httpsProxy: proxySchema,
} };
interface ProxyObservation { enabled: boolean; host: string | null; port: string | null; authInfo: { enabled: boolean } }
interface HttpObservation {
  userAgentConfigured: boolean; timeout: number; retries: number;
  nonProxyHosts: (string | null)[] | null; httpProxy: ProxyObservation; httpsProxy: ProxyObservation;
}
const host = (value: string | null) => value !== null && /^[A-Za-z0-9._:[\]-]*$/.test(value) ? value : null;
const proxy = (value: any): ProxyObservation => ({
  enabled: value.enabled, host: host(value.host),
  port: value.port === "" || /^\d{1,5}$/.test(value.port ?? "") && Number(value.port) <= 65535 ? value.port : null,
  authInfo: { enabled: value.authInfo.enabled },
});
const fields = [
  { label: "User-Agent configured", value: (r: HttpObservation) => r.userAgentConfigured },
  { label: "Timeout (s)", value: (r: HttpObservation) => r.timeout },
  { label: "Retries", value: (r: HttpObservation) => r.retries },
  { label: "Non-proxy hosts", value: (r: HttpObservation) => JSON.stringify(r.nonProxyHosts) },
  ...(["httpProxy", "httpsProxy"] as const).flatMap(key => [
    { label: `${key} enabled`, value: (r: HttpObservation) => r[key].enabled },
    { label: `${key} host`, value: (r: HttpObservation) => r[key].host },
    { label: `${key} port`, value: (r: HttpObservation) => r[key].port },
    { label: `${key} authentication enabled`, value: (r: HttpObservation) => r[key].authInfo.enabled },
  ]),
];
export const systemCommand = command("system", "Inspect Nexus system settings", [
  command("http", "Inspect outbound HTTP settings", [
    command("get", "Inspect global outbound HTTP settings without credentials", async (_input, c): Promise<HttpObservation> => {
      let response: Response;
      try { response = await checked(c, "http"); }
      catch (error) {
        if (error instanceof CliError && error.code === "nexus.requestFailed")
          throw new CliError("Read Nexus HTTP settings: request failed.", { code: "nexus.requestFailed" });
        throw error;
      }
      let data: any;
      try {
        data = validateDto(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
          await readResponseBody(response, { maxBytes: 65536, signal: c.signal }),
        )), schema, {}, true);
      } catch {
        // Neither parser errors nor raw/cause data may carry global proxy credentials.
        throw new CliError("Nexus HTTP settings response is invalid or exceeds 64 KiB.", { code: "nexus.decodeFailed" });
      }
      return {
        userAgentConfigured: typeof data.userAgent === "string" && data.userAgent.length > 0,
        timeout: data.timeout, retries: data.retries,
        nonProxyHosts: data.nonProxyHosts === undefined || data.nonProxyHosts === null ? null : data.nonProxyHosts.map((v: string) => /^[A-Za-z0-9.*_:[\]|-]*$/.test(v) ? v : null),
        httpProxy: proxy(data.httpProxy), httpsProxy: proxy(data.httpsProxy),
      };
    }, { permission: Permission.ReadOnly, view: recordView<HttpObservation>({ fields }) }),
  ]),
]);
