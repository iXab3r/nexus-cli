# nexus-cli

Standalone Nexus Repository CLI built on `@eyeauras/cli-factory` **0.6.1**.

M1 provides profile configuration, Basic or explicit anonymous access, local
credential status/logout, service availability, and repository list/detail.
The command tree provides components/assets list/get, search and downloads,
raw/Maven uploads, deletion, and raw hosted inspection/create.
Final story and milestone acceptance is tracked in GitHub Issues. Tests use the pinned 3.96.3-01 specification and synthetic
responses; no live Nexus version or edition compatibility is claimed.

```sh
printf '%s' '{"username":"synthetic-reader","password":"synthetic-password"}' | nexus-cli profile configure lab --url https://nexus.example.test:443/context --credentials-stdin
nexus-cli profile configure public --url https://nexus.example.test --auth-mode anonymous
nexus-cli auth status --profile lab
nexus-cli status --profile lab
nexus-cli repositories list --profile lab --json
nexus-cli repositories get releases --profile lab
nexus-cli auth logout --profile lab
```

The credential pair is stored through Core's profile-scoped secret store, not in
profile JSON. Password bytes are preserved. Missing or malformed pairs fail;
401 probes preserve prior state. A 403 probe admits locally valid credentials
because a narrower repository request may still work. No Basic failure retries
anonymously. Logout removes local credentials only.

Core's configure result uses `authenticated: true` as persistence admission,
not identity proof. Nexus details under `identity` report `storedUnverified` or
`anonymousConfigured`, preserved URL and probe outcome. Explicit auth status
reports `authenticated: false`, local `ready`, state and independent probe outcome
(`notRun`, `accessObserved`, `denied`, `rejected`, `unavailable`). HTTP success
never proves identity. Anonymous logout leaves the explicit anonymous mode enabled.
Core supplies the profile/auth human renderer and JSON/RPC envelopes; stdin
credentials require ordinary CLI execution, not RPC. No credential environment
variable or password command-line flag is supported.

Read service leaves use the profile's ReadOnly gate; mutations require Update. Repository lists show only server
visibility, including an empty success; they are not full installation inventories.
Summary fields are name, format, type, URL and online (`null` when the server omits
online). A single response is limited to 4 MiB and lists to 1,000 entries.
Repository names are encoded as one path segment. Availability uses both
`/service/rest/v1/status` and `/service/rest/v1/status/writable`; failure including
503 exits 1 and never proves authentication. All service errors use stderr in
ordinary CLI execution and RPC error envelopes, with no response body dump.

Core parser failures, including omitted required options, use `usage` and exit 1.
Nexus domain validation, such as an invalid selector or unequal delete
confirmation, exits 2 before HTTP. Both are failures; scripts must stop on any
nonzero exit. Server statuses retain their HTTP-derived codes: 400 is
`http.rejected`, 401 is `http.unauthorized`, and 403 is `http.forbidden`.
Nexus 3.96.3-01 Community can reject a restricted component upload with 400;
that status alone does not establish a credential or permission diagnosis.


## Development

Use Node.js 22.14 or newer, the npm version pinned in `packageManager`, and .NET 10 for the build driver.
The packaged CLI supports Node.js 22 or newer.

```sh
npm ci
npm test
npm run build
npm run test:package
node dist/src/bin.js --help
```

Dependency installation requires npm registry access (or a populated cache).
After setup, `npm test` runs offline with MSW at native fetch, temporary AppData
and an in-memory secret store supplied by the factory fixture. Unhandled HTTP
requests fail. Extend `tests/offline.ts` with story-owned MSW handlers and test
the real command tree; do not replace fetch with a mock implementation.

The separate package smoke packs an archive, verifies its exact file allowlist,
installs into a disposable npm prefix, and runs the actual executable's help, version, anonymous configure and profile inspection with network connections blocked and isolated user directories.
Its dependency-install phase may access npm; command execution is offline.
Temporary installation files are removed afterward. The archive includes only
runtime JavaScript, package metadata and this README.

The first release candidate is `@eyeauras/nexus-cli@0.1.0`. [Build and release](docs/release.md)
describes the TeamCity main-only Verify job, manual npm staging, owner 2FA approval,
and registry verification. CI configuration and publication are delivery-lead actions;
package metadata alone is not a publication claim. Published Core 0.6.1 adoption
has passed the full clean local Verify, Pack and DryRun gates described there;
repeat them for each release revision before staging.

Credential JSON read from stdin is limited to 64 KiB (UTF-8 bytes). Cancellation
while waiting for input stops before HTTP or credential persistence.

## Read and search

Asset `fileSize` values retain their exact signed int64 value in asset/component
lists, details and metadata search results, including nested assets. JSON/RPC
use a number within JavaScript's safe-integer range and an exact decimal string
outside it. Human metadata views show exact byte counts. An absent optional size
stays absent; an invalid, fractional or out-of-int64 size rejects the document or
whole page, retaining the first undelivered checkpoint. Other metadata attributes
keep their existing representation. Downloaded byte counts remain a separate
transfer result.

```sh
nexus-cli components list --repository releases
nexus-cli components get COMPONENT_ID
nexus-cli assets list --repository releases --all --max-pages 10
nexus-cli assets get ASSET_ID
nexus-cli search components --repository releases --name widget --artifact-version 1.0
nexus-cli search assets --maven-extension jar --maven-classifier ""
nexus-cli search assets --repository snapshots --maven-base-version 1.2-SNAPSHOT --sort version --direction desc --prerelease true
nexus-cli search download --repository snapshots --name widget --maven-base-version 1.2-SNAPSHOT --maven-extension jar --maven-classifier '' --sort version --direction desc --prerelease false --profile lab
```

All three search commands (`components`, `assets`, `download`) accept
`--repository`, `--name`, `--artifact-version`, `--group`, `--format`, `--q`,
`--maven-base-version`, `--sort`, `--direction`, and `--prerelease`.
Asset search and search download also accept `--maven-extension` and
`--maven-classifier`. An omitted classifier sends no filter; `--maven-classifier ''`
sends an empty filter. Maven base version maps to `maven.baseVersion`; it is a
string, such as `1.2-SNAPSHOT`, distinct from an explicit `--artifact-version`.

`--sort` accepts `group`, `name`, `version`, or `repository`; `--direction` accepts
`asc` or `desc`. Direction can be supplied without sort, matching the pinned API;
no direction or sorting is added when omitted. The convenience `--prerelease`
flag accepts lowercase `true` or `false`; the native parameter is a string. These filters persist across pages
and must be supplied again when resuming with a continuation token.

The three search commands also accept repeatable `--filter <json>` objects with
exact native `name` and string `value` fields, plus `--timeout <seconds>`:

```sh
nexus-cli search assets --filter '{"name":"repositoryName","value":"releases"}' --filter '{"name":"sha256","value":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
nexus-cli search components --filter '{"name":"raw.name","value":"demo.bin"}' --timeout 30
```

This exposes all 80/80/79 declared query dimensions of the pinned specification,
including digest, update and format selectors. Generic values preserve empty
strings, whitespace and Unicode. `sort`, `direction`, `timeout` and
`continuationToken` use their dedicated options; download has no continuation
option. The native `version` key maps to the same parameter as
`--artifact-version`; root `--version` still reports this executable's version.
The boolean prerelease flag remains a convenience; a native `prerelease` string
can be supplied through `--filter`.

Each wire key has one value in this CLI. Duplicate filters or a filter conflicting
with a dedicated flag fail before HTTP; unknown names and descriptor fields are
usage errors. The pinned OpenAPI declares scalar parameters; the server source's
additional repeated-format OR behavior is outside this CLI contract. Timeout
accepts the signed int32 decimal range; it is forwarded as a server parameter,
not a client deadline. The inspected source does not apply it as a search deadline,
and an unsupported format/plugin/version can reject a request without fallback.
Core JSON/int32 parser failures exit 1; Nexus descriptor/conflict rules exit 2.

For `search download`, a native `sha256` filter selects remotely while the existing
`--sha256` checks downloaded bytes locally. Filters and timeout persist across
pages and must be supplied again when resuming. Native selectors do not add
OpenAPI operations or a live edition compatibility claim.

Without sorting, search download retains Nexus's unique-match behavior: ambiguous
matches fail without creating a file. An explicit sort requests deliberate server
selection. Matching and ordering belong to Nexus; the CLI performs no local version
ranking or extra metadata lookup. An explicit artifact version is sent unchanged.
Downloads report the saved path, bytes, SHA256, and verification status, using the
final response target's basename by default. They do not infer a selected version
from a filename or the requested filters. Search listings show versions only when
returned by Nexus. Selection options require the pinned endpoint schema; this
offline evidence does not establish live version or edition support.

IDs and continuation tokens remain opaque.
Metadata download URLs omit userinfo, query and fragment to protect credentials.

Enumeration returns items, pagesFetched, complete, continuationToken, resume and
reason. Default execution reads one page, even an empty page with a next token.
Use --all for enumeration and --continuation-token TOKEN to resume. Defaults are
100 pages with --all, 4 MiB decoded bytes/page, 1,000 items/page, 10,000 total items
and 16 MiB serialized result. --max-pages, --max-page-bytes, --max-page-items,
--max-items and --max-result-bytes accept positive reductions only.
A failed or oversized page is rejected whole. Partial results exit 1, with
resume identifying the first undelivered page; restart=true means start without
a token. Repeated tokens fail with resume=null. Ordinary JSON puts partial data
on stdout and diagnostics on stderr; RPC puts it in error.data.result.
There is no snapshot or duplicate-free guarantee across server mutations.
Narrow server filters when a single page exceeds a limit.

Downloads use Core 0.6.1 publishFile with invocation-cwd defaults and optional
`--output`. The parent directory must exist; existing destinations are never overwritten.
Byte limits and optional SHA256 validation apply before publication. Cleanup failures
report the actual publication state and exit 1.
The installed-package smoke exercises asset/search downloads and JSON/RPC failure
results, reads, uploads and hosted commands with synthetic responses and sockets blocked.

An enumeration result budget must fit the initial checkpoint, including any supplied
continuation token. Otherwise the command fails before HTTP with no partial result.

Detail commands reject the exact identifiers `.` and `..` before HTTP because URL
normalization treats them as navigation. Other identifiers remain encoded as one segment.


Artifact coordinates use `--artifact-version` in Maven upload and search. Root
`--version` reports the executable version; the former leaf spelling was consumed
by that root option before the command handler. Wire keys remain `version` for
search and `maven2.version` for Maven publication.

Uploads use Node 22's file-backed Blob and native multipart FormData. The CLI
requires a regular file (rejecting a final symlink) and does not buffer the whole
file or impose the provisional 64 MiB ceiling. Payload memory is streamed by the
runtime; file length and server limits bound the transfer. Keep the source file
unchanged throughout the operation: Node checks for modification during reads,
but this is not a filesystem snapshot or a hostile-filesystem guarantee. Opening
and sending respect cancellation; cancellation or read failure after sending
starts has unknown remote outcome. There is no automatic retry. Only HTTP 204
acknowledges a mutation; it supplies no new component ID, atomicity or rollback
proof. Maven may generate POM/checksum assets; repository-level edit permission
is recommended for that workflow (see source contracts).

### Discover blob stores and upload fields

```text
nexus-cli blobstores list --profile lab
nexus-cli formats upload-specs list --profile lab --json
nexus-cli formats upload-specs get raw --profile lab
```

`blobstores list` uses GET `/service/rest/v1/blobstores` and returns an array of
`{name,type}`. Upload-spec listing uses GET `/service/rest/v1/formats/upload-specs`
and returns an array of `{format,multipleUpload,componentFields,assetFields}`;
`get <format>` returns one such object. Each field contains `name`, `optional`
and `type` when supplied by the server. Human output separates component fields
(supplied once per component) from asset fields (supplied for each asset), and
labels required/optional fields. JSON and RPC carry the same projection. Quotas,
configuration, descriptions, groups, option maps and unknown attributes are omitted.
Multipart prefixes, numbered asset fields and binary file parts remain
format-specific; listing a format does not add an upload implementation for it.

Both lists succeed with an empty array. Each response has a fixed 4 MiB decoded
byte budget and at most 1,000 entries; each specification allows at most 64
component fields and 64 asset fields. Every projected name/type, including format,
has a 256-byte UTF-8 budget and rejects C0/DEL/C1 controls for terminal safety.
These are CLI resource/output limits, not Nexus schema limits. A malformed,
truncated or over-budget response fails with `nexus.decodeFailed`, exit 1 and no
partial result or response-body dump. Format `get` shares these field/label limits.
No automatic paging or retry is performed for discovery.

Both reads use local ReadOnly permission. Nexus discovery/admin permissions are
separate from repository create and publish rights: a denied blobstore list does
not prevent `repositories hosted raw create` with a known `--blob-store` name or
`components upload` under their own permissions. Neither operation performs a
discovery preflight. HTTP 401 means rejected authentication for that request;
403 means the action was denied. This CLI does not provision blob stores or
manage server RBAC. Shapes come from pinned 3.96.3-01 OpenAPI source, not a live
edition/version compatibility qualification.

### Check a known blob store quota

```text
nexus-cli blobstores quota-status existing --profile lab --json
```

This ReadOnly command makes one GET to
`/service/rest/v1/blobstores/{name}/quota-status`, without discovery or writes.
Nexus requires authentication and `nexus:blobstores:read`; the local permission
gate does not grant that server privilege. The result contains `blobStoreName`,
`isViolation` and the server's `message`. Human output escapes terminal controls;
JSON/RPC retain the service strings.

A false violation flag succeeds. Nexus also uses false plus a message when no
quota is configured, so the CLI does not invent a separate configured or health
flag. A soft quota is advisory and does not prove writes are blocked. A true flag
exits 1 with `nexus.blobstore.quotaViolation` and the complete quota result:
ordinary JSON puts the result on stdout and the error on stderr; RPC carries it
in `error.data.result`. HTTP/decode failures provide no quota result and do not
retry. A denied or missing store is not replaced by a discovery request.

### Import an original Maven POM

```sh
nexus-cli components upload maven --repository releases --pom widget.pom --asset '{"file":"widget.jar","extension":"jar"}' --asset '{"file":"widget-sources.jar","extension":"jar","classifier":"sources"}' --profile lab
```

Supply 1–16 repeated JSON descriptors containing only `file`, `extension`, and
optional `classifier`. The original POM is sent byte-for-byte as an unclassified
`pom` asset with `generate-pom=false`. Nexus interprets its coordinates, including
parent group/version inheritance, and rejects invalid or unresolved coordinates.
The CLI does not parse XML, resolve parents, or rewrite dependencies.

POM import cannot combine with `--file`, `--group`, `--artifact`,
`--artifact-version`, `--extension`, or `--generate-pom`. The existing generated-JAR
command remains supported. Extension/classifier pairs must be unique (empty and
omitted classifier are equivalent); unclassified `pom` is reserved. Suffixes use
ASCII letters, digits, hyphens, underscores, and nonempty dot-separated segments.
Prepared `jar.asc` and `pom.asc` files are opaque companions; no signing or
verification is performed.

PowerShell example (JSON backslashes must be escaped):

```powershell
nexus-cli components upload maven --repository releases --pom 'C:\artifacts\widget.pom' --asset '{"file":"C:\\artifacts\\widget.jar","extension":"jar"}' --profile lab
```

All inputs must be accessible regular files; final symlinks are rejected before
POST. Keep files unchanged during streaming. One multipart request requires the
local Update grant and server permissions. Only HTTP 204 acknowledges receipt;
there are no returned IDs or atomicity/rollback guarantees. Transport failure
means unknown outcome; inspect Nexus before deciding whether to repeat it.

In generated-JAR mode, POM generation is enabled by default. The optional
`--generate-pom true` makes that choice explicit; `false` is unsupported.
Original-POM mode rejects `--generate-pom` because the supplied POM is preserved.

Download a known repository path without metadata or search access:

```sh
nexus-cli content download --repository raw-releases --path releases/1.0/widget.zip --output widget.zip --profile lab
```

`--path` is a decoded relative slash-separated path. Spaces and Unicode are
encoded once per segment. Empty, dot and dot-dot segments, absolute paths/URLs,
backslashes and controls are rejected before HTTP or file creation. Percent signs
are conservatively rejected, including literal percent filenames, to exclude
encoded and nested-encoded navigation. The repository name is one opaque segment.
The configured installation context precedes `/repository/`; no discovery or
administrative preflight is performed. Server content-read permission is required.

The default destination is the safe final basename in the invocation directory;
`--output` accepts a relative or absolute path whose parent already exists.
Existing destinations are never overwritten. `--sha256` verifies an expected
64-digit SHA256 before publication; without it `verified` is false. Downloads use
the same streaming, redirect trust, cancellation, cleanup reporting and default
1 GiB cap (`--max-bytes` overrides it) as asset/search downloads. Results report
path, bytes, SHA256 and verified. This command does not resolve package dependencies.

Failed Nexus requests identify the operation and, when available, a conservative
repository label (ASCII letters, digits, dots, underscores and hyphens, up to 64
characters). Other names appear as “the selected repository” in diagnostics.
HTTP 401 means authentication was rejected for that request; HTTP 403 means Nexus
denied the action. Upload HTTP 400 hints name submitted fields and repository
policy checks; they do not diagnose the server response. Response bodies are not
included in errors. Local Update denial provides `permissions grant Update`
guidance before any HTTP request; enabling the local gate does not grant server
rights. An interrupted mutation still has an unknown outcome and is not retried.

## CI artifact roundtrip

Reproduce the offline packaged story with Node 22:

```sh
npm ci
npm test
npm run test:package
```

The package harness installs into a temporary prefix, blocks socket connections in
CLI subprocesses, substitutes only the platform secret-store methods and HTTP
boundary, and removes its temporary files on exit. It uses a synthetic stdin pair,
real command parsing/profiles, multipart upload and the real file publisher. npm
dependency installation may need registry access; the CLI roundtrip is offline.
No real keyring, Nexus server, container or global installation is needed.

For a separately authorized deployment, the following Bash recipe uses an existing
raw hosted repository and an already installed CLI. Set `NEXUS_URL`, `REPOSITORY`,
`SOURCE` and `DESTINATION`; the destination must not exist and its parent must exist.
Run as an isolated CI OS account with a fresh `ci` profile. The default profile is
unchanged. Keep the source immutable during upload. Choose a unique destination
repository path per build; this example uses `ci/artifact.bin`.

```bash
set -euo pipefail
set +x
: "${NEXUS_URL:?}" "${REPOSITORY:?}" "${SOURCE:?}" "${DESTINATION:?}"
nexus-cli profile create ci --json
# Feed a JSON {"username":"...","password":"..."} object from your CI secret
# provider on stdin. This example reads the already protected CREDENTIALS_JSON file.
: "${CREDENTIALS_JSON:?}"
nexus-cli profile configure ci --url "$NEXUS_URL" --auth-mode basic \
  --credentials-stdin --profile ci --json < "$CREDENTIALS_JSON"
trap 'nexus-cli auth logout --profile ci --json >/dev/null' EXIT
nexus-cli permissions grant Update --profile ci --json
sha=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; import {createHash} from "node:crypto"; console.log(createHash("sha256").update(readFileSync(process.argv[1])).digest("hex"))' "$SOURCE")
nexus-cli components upload raw --repository "$REPOSITORY" --directory ci \
  --filename artifact.bin --file "$SOURCE" --profile ci --json
nexus-cli content download --repository "$REPOSITORY" --path ci/artifact.bin \
  --output "$DESTINATION" --sha256 "$sha" --profile ci --json
node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; assert.deepEqual(readFileSync(process.argv[1]), readFileSync(process.argv[2]))' "$SOURCE" "$DESTINATION"
```

The shell stops on nonzero exit. Upload success is an acknowledged HTTP 204, not
an ID or transaction/rollback guarantee. An interrupted upload can have an unknown
remote outcome: inspect before retrying. Download JSON reports `path`, `bytes`,
`sha256` and `verified`; checksum mismatch exits nonzero without publishing a new
file. Existing destinations are never overwritten. The recipe does no enumeration.
If adding list/search steps, require `complete === true` before claiming completion;
otherwise inspect `resume` and `reason`, even after an exit-zero single-page result.
A null resume is not permission to restart blindly.

Credentials require working platform secure storage. On Linux, provision a working
Secret Service/keyring and its session access for the runner account; installing a
binary alone does not establish headless readiness. There is no plaintext fallback.
Windows uses DPAPI; macOS uses its keyring backend. Protect the credential input
outside the repository and remove it according to your CI provider's lifecycle;
do not enable shell tracing. Local `auth logout` deletes the local stored pair,
not the server credential, and does not revoke a Nexus user token.

A Nexus user-token name/pass-code pair can occupy the Basic username/password
fields. This is a transport statement only: supported server version, licensed
entitlement, token policy and live compatibility require separate qualification.
The offline source baseline is Nexus 3.96.3-01, not a live support certification.
The local Update grant permits CLI execution; it grants no Nexus server rights.
REST upload needs server repository admission and path edit rights; see the
[pinned upload source contract](docs/source-contracts.md#rest-upload-permissions-and-fields).

Use native npm, NuGet, Maven, Docker and Python package clients for their package
resolution, dependency, build and protocol workflows. This CLI supplies Nexus REST
management and supported raw/Maven transfers; it does not replace those clients.
Publish this raw recipe to a hosted repository. Proxy repositories cache upstream
content and groups aggregate repositories for consumption; they are not this
recipe's publication target. These distinctions follow the
[pinned Nexus source](https://github.com/sonatype/nexus-public/tree/829f297c35984a5fac590a366e949cd9a9a2eb79)
and [product/source baseline](docs/product-contract.md).
Secure-store and profile behavior follows
[CliFactory 0.6.1](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/DESIGN.md).
The offline secret-store substitute proves no platform keyring or live entitlement.
