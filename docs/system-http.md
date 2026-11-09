# Global outbound HTTP diagnostics

```sh
nexus-cli system http get --profile administration --json
```

This ReadOnly command sends one GET to `/service/rest/v1/http` on the selected
installation, using its Basic/anonymous profile. Nexus separately requires an
authenticated principal with `nexus:settings:read`. An anonymous request can be
denied; local ReadOnly permission does not grant server authority.

The native response is bounded to 65,536 bytes of valid UTF-8 JSON. Only HTTP 200
is decoded; 401/403/404/5xx remain failures. Invalid shape, malformed JSON or an
oversized response returns `nexus.decodeFailed`, without response bytes/parser
causes. No credentials or HTTP settings are saved in a profile.

All human/JSON/RPC modes use this same observation:

```json
{
  "userAgentConfigured": false,
  "timeout": 60,
  "retries": 2,
  "nonProxyHosts": ["localhost", "*.example.test"],
  "httpProxy": {
    "enabled": false,
    "host": "",
    "port": "",
    "authInfo": { "enabled": false }
  },
  "httpsProxy": {
    "enabled": false,
    "host": "",
    "port": "",
    "authInfo": { "enabled": false }
  }
}
```

Values above are synthetic, not observed settings. The projection omits the raw
User-Agent, auth username/password and NTLM host/domain, including password masks.
Host/port strings containing URI credentials, query data or unsafe characters are
withheld as null; nonProxyHosts retains ordinary host/glob entries and withholds
other spellings as null entries. Omitted/null nonProxyHosts remains null, not an
assertion of an empty bypass list. The observation is not a writable native DTO.

This describes global outbound HTTP client defaults/proxies. It does not expose a
TLS truststore/certificate inventory, establish network reachability, or identify
why a repository's upstream request returned 502/404. Repository remoteUrl,
httpClient blocked/autoBlock/connection/useTrustStore and negative-cache settings
remain separate typed repository observations. Disabled global proxies do not
prove server DNS/TLS/network health.

## Source contract

The official 3.96.3-01 [pinned specification](api/nexus-openapi.json) defines
GET `/v1/http` → 200/HttpSettingsXo, PUT → 204, and DELETE/reset → 204. This command
implements GET only; it declares no service input/stdin, update, reset or delete.

The official 3.97.0-13 image/layer pinned in [the key protocol](nuget-key-protocol.md)
confirms these contracts in bytecode:

- `HttpSettingsApiResourcePro` in nexus-api-rest-selfhosted-private JAR
  SHA256 `859617b568d9e98aa074ae23604a3707b5f45f285c61483014d98b02ff722d05`:
  selfhosted distribution registration, `/v1/http`, GET requires authentication and
  `nexus:settings:read`, explicit Response.status(200).entity(settings).
- `HttpSettingsApiResourceProService`, `HttpSettingsXo`, `ProxySettingsXo`,
  `AuthSettingsXo` in nexus-api-extension-plugin JAR
  SHA256 `4f8530cee1ac5502b0ef4acd7c9f63151fbcf72edf30d664540a6e79b69fc6f7`:
  getHttpSettings reads HttpClientManager configuration; convert supplies defaults
  for timeout/retries, empty User-Agent/bypass list, and disabled HTTP/HTTPS proxy
  objects. Configured proxy ports are strings. Auth responses can contain usernames
  and NTLM identity; passwords are masked by the service. CLI projection independently
  withholds these fields instead of relying on server masking.

If diagnosis establishes a need to replace settings, the bounded next contract is
`system http update --input-file <protected-json>`, using native HttpSettingsXo
(userAgent, timeout 1–3600, retries 0–10, nonProxyHosts, both complete proxy objects;
authInfo includes enabled/username/password/ntlmHost/ntlmDomain), a finite owner-only
file and exact 204 acknowledgement. That mutation is not implemented or performed
in this diagnostic chunk. A masked GET/CLI observation must not be blindly replayed
as replacement input. No reset/delete or blanket network reconfiguration is implied.

## Cargo proxy endpoint discrimination

Pinned Cargo JAR SHA256
`c0862bf01016a2fd21df9e0826022af8b6f3d54ba3b08d50ae24ed0095e6b91b`:
`CargoProxyRecipe.configure` explicitly routes GET `/config.json` as AssetKind.CONFIG,
then crate downloads `/crates/{name}/{version}/download` and sparse index manifests
`/{path}/{name}`. The content route runs security before the proxy handler. Thus the
client registry base is the repository root, with `/config.json` appended; adding
`/index/` is not an alternative CONFIG endpoint on this recipe.

`CargoProxyFacet.getUrl` removes the leading slash from the request path;
`refreshConfigCache` resolves relative `config.json` against getRemoteUrl.
`ContentProxyFacetSupport` extends `ProxyFacetSupport`; its normalizeURLPath ensures
a trailing slash on the configured remote base. The native request field is
`proxy.remoteUrl`: an HTTP(S) sparse-index base serving config.json and Cargo's
sharded manifest paths, not a git-index repository URL, a config.json filename or
a crate download/API endpoint. For example the synthetic base
`https://upstream.example.test/sparse/` resolves config to
`https://upstream.example.test/sparse/config.json`. No Cargo-specific nested remote
property or automatic `/index/` suffix exists. Crate downloads use upstream config's
dl data; local config is rewritten for the Nexus repository. Unknown cached/missing
content and negative-cache/upstream failures still need runtime diagnosis.

This source evidence does not classify the reported 404/502 as either an incorrect
remote base or global HTTP settings failure. No production probes were performed.
