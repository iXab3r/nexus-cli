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

## Delete one repository and inspect group references

```sh
nexus-cli repositories list --include-group-members --profile administration --json
nexus-cli repositories get synthetic-group --include-group-members --profile administration --json
nexus-cli repositories delete synthetic-group --confirm-name synthetic-group --profile administration --json
```

Delete is generic across repository formats/types. It requires local Update and an exact,
case-sensitive confirmation of a valid native repository name. Before sending DELETE it performs
GET `/service/rest/v1/repositories/<name>` and verifies the returned name. A failed/missing/denied
or mismatched preflight prevents deletion. The mutation sends exactly one DELETE to that same
name, refuses redirects without following them, and acknowledges only HTTP **204**, returning `{name,acknowledged:true}`. Neither a DELETE
404 nor a transport failure is accepted as successful cleanup. Unexpected 2xx produces
`nexus.mutation.acknowledgementUnknown`; transport failure produces `nexus.mutation.outcomeUnknown`.
Both require state reconciliation before retrying. A redirect also produces an unqualified acknowledgement
error without sending a request to its Location. There is no retry, cascade flag or force flag.

The native operation deletes the repository and its logical contents; this command does not call
blob-store deletion/reset or delete any additional repository. Server soft-delete/garbage-collection
behavior is independent: 204 is not proof that physical bytes disappeared or the shared blob store
was emptied. Confirm exact target absence and preserve/read back untargeted repositories and blob
stores separately. Preflight is not atomic with deletion; use exclusive administrative coordination.
The CLI does not automatically detach group references or prove that every group is visible.

Group reference reads require local ReadOnly. Stock generic GET/catalog RepositoryXO does **not**
include group members: its attributes projection supplies proxy.remoteUrl for proxies and otherwise
an empty map. Ordinary reads keep that contract. With `--include-group-members`, GET/list additionally
reads official GET `/service/rest/v1/repositorySettings` once when selected rows contain groups.
Its native format adapters expose `group.memberNames`. The CLI joins settings to each selected group
by exact name, checks format/type identity, validates every native repository name, and returns only:

```json
{ "attributes": { "group": { "memberNames": ["synthetic-hosted", "synthetic-proxy"] } } }
```

This is an explicit composition, not a claim that generic GET returned those attributes. Order is
preserved. Arbitrary settings/attributes, writableMember and upstream credentials are not projected.
Missing/duplicate identity, missing/malformed members or a failed settings request fails the read;
it is never converted to an empty list. Settings JSON is bounded to 4 MiB/1000 records and decoding
errors do not include raw settings/cause text. A non-group-only selection does not fetch settings.

Repository settings are filtered by server repository-admin read permissions. A complete dependency
check needs an independently qualified administrative view of all relevant groups; a filtered catalog
cannot establish no references. Before a group-first cleanup, inspect all groups and stop if any
untargeted group references a target; deleting a group is not an authorization to delete its members.
Compare before/after metadata for every untargeted repository and the shared blob store. This
command receipt alone does not establish those preservation checks.

Source: the pinned specification defines DELETE `/v1/repositories/{repositoryName}` → 204 and
GET `/v1/repositorySettings` → an array of native settings. In official 3.97.0-13
nexus-repository-services JAR SHA256
`b4b8202edd94e06f09259c452aec3a4100c08ef73d5424c33f39b5bc7e0fef02`:

- `RepositoriesApiResource.deleteRepository` invokes RepositoryDeletionService and explicitly
  returns NO_CONTENT. Some denied/missing/illegal-state outcomes are intentionally mapped to 404;
  that status is not a general authorization-independent absence proof.
- `RepositoryDeletionService.delete` requires an authenticated repository-admin delete permission
  for the exact format/name and delegates to native delete or an enabled soft-delete service.
- `RepositoriesResource.getRepository` and `RepositoryXO.fromRepository/attributes` provide the
  generic identity/proxy projection; group settings are not present there.
- `RepositorySettingsApiResourceV1` registers `/v1/repositorySettings`; getRepositories uses
  AuthorizingRepositoryManager.getRepositoriesWithAdmin, then native adapters' adaptDecorated.
  The authorizing manager filters by repository-admin read. SimpleApiRepositoryAdapter group
  settings use GroupDeployAttributes/memberNames; format adapters preserve the same native field.

These are source/offline contracts. All committed examples are synthetic; no production deletion
was performed to qualify this capability.
