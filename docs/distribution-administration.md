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
`type` and `url` must be removed before using a GET result as mutation input. Nexus 3.97 NuGet
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
