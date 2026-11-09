# Distribution repository administration

Cargo, NuGet, npm and Docker each expose hosted, proxy and group settings:

```sh
nexus-cli repositories proxy nuget get packages --json
nexus-cli repositories proxy nuget create --input-file repository.json --json
nexus-cli repositories proxy nuget update packages --input-file repository.json --json
```

JSON files contain at most 64 KiB of UTF-8 text. Service commands do not consume stdin.

The JSON input is the complete Nexus request DTO, including `name`. On update it must
match the command argument. Known optional settings are preserved when supplied; unknown
fields and invalid field types fail before a write. GET returns supported configuration,
including ordered group members, without password/token fields. Returned URLs omit userinfo, queries and fragments;
resupply any required protected upstream credentials separately when preparing input. Response-only `format`,
`type` and `url` must be removed before using a GET result as mutation input. Nexus 3.97 NuGet, npm and Docker
proxy observations also include response-only `storage.writePolicy`; remove that field for proxy
create/update. The proxy request does not represent a hosted deployment policy. GET preserves this
source-backed observation instead of treating it as an unknown setting.

The request schemas come from the pinned 3.96.3-01 official OpenAPI in
`docs/api/nexus-openapi.json`; `src/repository-schemas.ts` retains their selected field
constraints and references. This does not establish live write entitlement or compatibility
with every Nexus edition/version. Server refusal remains a failure.

GET requires ReadOnly; create/update require Update. Mutations execute once and acknowledge
only the documented 201/204 response. A transport failure leaves the remote outcome unknown.
PUT replaces settings and is not atomic with a preceding GET: another administrator's intervening
change can be lost. Preserve independently approved settings when preparing the full input.
No comparison or automatic retry prevents concurrent changes.

Group `memberNames` order is significant. Leave `writableMember` unset for hosted-only
publication; group deployment is a separate Pro capability. Cargo's authentication override
belongs to proxy/group, not hosted. Docker `forceBasicAuth=false` is not evidence of anonymous
access: active realms, anonymous configuration and repository privileges also matter.

A complete ordered [reconfiguration recipe](distribution-reconfiguration.md) prepares all 28 synthetic
repositories and composes the security/key commands with independently approved target inputs.

## Selected 3.97 npm and Docker DTO differences

The 3.96.3 public request-schema baseline has source-backed 3.97.0-13 extensions:

- npm proxy GET and mutation input preserve `npm.removeQuarantinedVersions` (optional Boolean).
  This is the native canonical JSON name; unknown nested fields and string booleans are rejected.
  Keep it when preparing activation/full PUT; remove only response identity and storage writePolicy.
- Docker proxy GET and mutation input preserve optional `dockerProxy.layerDownloadTimeoutMinutes`
  (integer 1–1440, or null). The native converter sets a supplied integer and removes this
  configuration attribute for null/omission. Preserve an observed configured value on full PUT.
- NuGet/npm/Docker proxy adapters pass HostedStorageAttributes on reads, even though proxy
  mutation DTOs accept StorageAttributes. Read projection preserves storage.writePolicy; request
  validation continues to reject it. Cargo's generic proxy adapter does not receive this override.

These are not silent response drops or automatic translations to a deployment policy.
The npm flag is a deprecated legacy PCCS toggle derived from `firewall.mode` on GET.
`NpmProxyRepositoryApiRequestToConfigurationConverter` honors explicit firewall.mode first;
without an explicit mode, legacy true requests PCCS and performs the server's capability/permission
validation. Legacy false/null does not itself force an explicit firewall mode. Preserve returned
firewall settings as well; the CLI does not synthesize, enable or disable Firewall modes.
Representing this native field does not establish edition entitlement or live mutation success.

Provenance: official 3.97.0-13 image/layer pinned in [the key protocol](nuget-key-protocol.md).
Rehashed npm JAR: `47c9b106abd66770a5ab4772126539cf9645d4a3f964d1676b8782b9c783939b`;
Docker JAR: `6cd1fdd094514407015ffe17dcb20977f7f7abdaca13d6d1df6bf316810003e1`.
Bytecode contracts: NpmApiRepositoryAdapter.adapt/createNpmAttributes; NpmAttributes JsonCreator
and getRemoveQuarantined both use JsonProperty(removeQuarantinedVersions); NpmProxyRepositoryApiRequest
contains npm and its converter applies the legacy shim. DockerApiRepositoryAdapter.adapt uses
hosted storage for proxy; DockerProxyAttributes request and response classes both expose layer timeout;
request annotations specify Min(1)/Max(1440), and the proxy converter stores/removes the same attribute.

The source audit also checked Docker hosted/group adapter shapes: hosted uses DockerHostedStorageAttributes
including latestPolicy, group uses StorageAttributes/GroupDeployAttributes; Docker routing attributes
match the existing request schema. Storage globalDistribution is explicitly filtered out of Community/Pro
responses as an Enterprise-only property; this patch makes no Enterprise compatibility claim.
Offline tests use synthetic source-shaped values, including null defaults, never a production response.
