# REST coverage comparison

How much of the Sonatype Nexus Repository REST API each tool can call. Measured 2026-11-10.

| Tool | Reachable operations | GET (166) | POST, PUT, DELETE (276) |
|---|---:|---:|---:|
| `nexus-cli` 0.3.0 (this package) | 20 of 442 (5%) | 16 | 4 |
| `n3dr` 7.6.0 (Go, GitHub release of `030/n3dr`) | 23 of 442 (5%) | 5 | 18 |
| `nexus3` 4.2.1 (Python `nexus3-cli` from PyPI) | 18 of 442 (4%) | 8 | 10 |
| `nexus` 0.8.0 (Go, GitHub release of `sonatype-nexus-community/nexus-cli`) | 5 of 442 (1%) | 4 | 1 |

In `nexus-cli` the 16 GET operations are the ReadOnly commands and the other 4 need the Update
grant. `nexus-cli` shares three operations with `n3dr`, five with `nexus3` and four with the
community `nexus`; no operation is reachable from all four. Together the four tools reach 54.

All four tools cover a small part of the API, and each a different part: `n3dr` creates
repositories, users and roles and moves artifacts in bulk, `nexus3` manages blob stores, tasks
and scripts, the community `nexus` reads status and lists. `nexus-cli` is selected story by story
for artifact work (find, download, publish, delete) and has no server administration commands
yet; the inventory is a census, not a promise to implement every operation.

## Tools considered

Every command-line client for Nexus Repository found on npm, PyPI, crates.io, the Go module
proxy, RubyGems, the PowerShell Gallery, Homebrew, GitHub and GitLab on 2026-11-10. Sonatype
publishes no command-line client of its own for Nexus Repository; the Homebrew `nexus` formula is
the server.

| Tool | Published | Version, date | Popularity | Outcome |
|---|---|---|---|---|
| `n3dr` (`030/n3dr`) | GitHub releases, Go | 7.6.0, 2024-12-28 | 168 stars; 3,668 downloads of the release | Measured: 23 of 442 |
| `nexus3` (`nexus3-cli`) | PyPI | 4.2.1, 2024-06-15 | 47 stars (23 GitLab, 24 on the former GitHub home); 6,187 PyPI downloads last month | Measured: 18 of 442 |
| `nexus` (`sonatype-nexus-community/nexus-cli`) | GitHub releases, Go | 0.8.0, 2020-02-21; archived | 27 stars; 2,305 downloads of the release | Measured: 5 of 442 |
| `NexuShell` (`steviecoaster/NexuShell`) | PowerShell Gallery | 1.2.0, 2025-03-13 | 20 stars; 3,233 Gallery downloads in total | Not measured: a PowerShell module of REST cmdlets; fourth by stars |
| `nexus-scripting` (`cloudogu/nexus-scripting`) | GitHub releases, Go | 0.3.2, 2026-02-17 | 5 stars; 415 downloads of the release | Not measured: outranked. It runs Groovy scripts through the script API |
| `nexus3-cli` (`liang-junwei/nexus3-cli`) | GitHub release, Go module | 1.0.0, 2026-07-09 | 1 star; 4 downloads of the release | Not measured: outranked |
| `nxr` (`nexus-raw`) | crates.io | 0.26.0, 2026-11-09 | 1 star; 356 crate downloads in total | Not measured: outranked. It transfers raw repository content |
| `nexus3-tool` (`tkdpython/nexus3-tool`) | PyPI | 0.7.0, 2026-07-02 | 0 stars; 23 PyPI downloads last month | Measured earlier: 7 of 442 (5 GET, 2 write). Outranked, so it has no column; a Docker image cleanup tool |
| `nexus3-go` (`M0Rf30/nexus3-go`) | GitHub releases, Go module | 0.6.0, 2026-10-07 | 0 stars; 67 downloads of the release | Not measured: its API commands are generated at run time from the server's own OpenAPI document, which is not coverage by the rule below |
| `nexus-cli` (`mlabouardy/nexus-cli`) | GitHub source only, Go | no tagged release; last commit 2018-08-23 | 295 stars | Not measured: it calls only the Docker Registry API under `/repository/{name}/v2/`, not the Nexus REST API, and has no pinned release |
| `nexus-cli` (RubyGems `nexus_cli`) | RubyGems | 4.1.1, 2016-10-19 | 69 stars; 332,258 gem downloads in total | Not measured: a client for the Nexus Repository 2 API (`/service/local/`), which Nexus Repository 3 does not serve |
| `artifact`, `repo` (`repositorytools`) | PyPI | 4.2.5, 2018-02-01 | 58 stars; 1,470 PyPI downloads last month | Not measured: a client for the Nexus Repository 2 API (`/service/local/`) |
| `nexus3-export` (`lbar/nexus3-export`) | GitHub source only, Java | no release | 45 stars | Not measured: no published version to pin; a single-purpose repository export |
| `nexus3-exporter` (`LoadingByte/nexus3-exporter`) | GitHub source only, Python | no release | 29 stars | Not measured: no published version to pin; a single download script |

Selection rule: a tool gets a column when it is a command-line client for the Nexus Repository 3
REST API (not a library, an MCP server, a plugin or a wrapper that sends raw or generated
requests) and is published at a version that can be pinned; when more than three qualify, the
three with the most source-repository stars are measured, whatever they score. Download counts
are shown where a registry reports them, but they are not comparable between registries and do
not decide the order.

## By API area

Percent of operations reachable, with the count in brackets.

| API area | Operations | nexus-cli 0.3.0 | n3dr 7.6.0 | nexus3 4.2.1 | nexus 0.8.0 |
|---|---:|---:|---:|---:|---:|
| Components, assets, upload specs | 9 | 100% (9) | 22% (2) | 22% (2) | 11% (1) |
| Search | 6 | 50% (3) | 0% (0) | 17% (1) | 0% (0) |
| Repositories: list, inspect, browse | 10 | 20% (2) | 20% (2) | 10% (1) | 10% (1) |
| Hosted repository settings | 69 | 3% (2) | 10% (7) | 0% (0) | 0% (0) |
| Proxy repository settings | 75 | 0% (0) | 5% (4) | 0% (0) | 0% (0) |
| Group repository settings | 63 | 0% (0) | 2% (1) | 0% (0) | 0% (0) |
| Blob stores and data store | 23 | 9% (2) | 0% (0) | 26% (6) | 0% (0) |
| Status, nodes, support, recovery | 23 | 9% (2) | 0% (0) | 0% (0) | 13% (3) |
| Tasks, scripts, capabilities | 20 | 0% (0) | 0% (0) | 40% (8) | 0% (0) |
| Cleanup, routing, selectors, tags | 24 | 0% (0) | 0% (0) | 0% (0) | 0% (0) |
| Users, roles, privileges, tokens | 39 | 0% (0) | 15% (6) | 0% (0) | 0% (0) |
| LDAP, SAML, Crowd, realms | 29 | 0% (0) | 3% (1) | 0% (0) | 0% (0) |
| Certificates, encryption, network | 24 | 0% (0) | 0% (0) | 0% (0) | 0% (0) |
| Firewall, license, instance config | 28 | 0% (0) | 0% (0) | 0% (0) | 0% (0) |
| **All operations** | **442** | **5% (20)** | **5% (23)** | **4% (18)** | **1% (5)** |

## By inventory group

Reachable operation counts. Groups are the inventory's tracker roots, with the per-format
`Repository Management` roots merged by repository type.

| Resource group | Operations | nexus-cli 0.3.0 | n3dr 7.6.0 | nexus3 4.2.1 | nexus 0.8.0 |
|---|---:|---:|---:|---:|---:|
| `assets` | 3 | 3 | 0 | 1 | 0 |
| `Azure blob store` | 1 | 0 | 0 | 0 | 0 |
| `Blob store` | 20 | 2 | 0 | 6 | 0 |
| `Capabilities` | 5 | 0 | 0 | 0 | 0 |
| `Cleanup policies` | 5 | 0 | 0 | 0 | 0 |
| `Community Edition Eula` | 2 | 0 | 0 | 0 | 0 |
| `components` | 4 | 4 | 2 | 1 | 1 |
| `Content selectors` | 5 | 0 | 0 | 0 | 0 |
| `Data Store` | 2 | 0 | 0 | 0 | 0 |
| `Email` | 4 | 0 | 0 | 0 | 0 |
| `Formats` | 2 | 2 | 0 | 0 | 0 |
| `Instance configuration` | 7 | 0 | 0 | 0 | 0 |
| `Internal UI: API permissions` | 1 | 0 | 0 | 0 | 0 |
| `Lifecycle` | 3 | 0 | 0 | 0 | 0 |
| `Malicious Risk On Disk` | 2 | 0 | 0 | 0 | 0 |
| `Manage Sonatype HTTP System Settings` | 3 | 0 | 0 | 0 | 0 |
| `Manage Sonatype Repository Firewall configuration` | 11 | 0 | 0 | 0 | 0 |
| `Monthly Metrics` | 1 | 0 | 0 | 0 | 0 |
| `Product licensing` | 3 | 0 | 0 | 0 | 0 |
| `Reconcile Plan` | 9 | 0 | 0 | 0 | 0 |
| `Recovery Mode` | 2 | 0 | 0 | 0 | 0 |
| `Repository Browse` | 2 | 0 | 0 | 0 | 0 |
| `Repository Management / General` | 8 | 2 | 2 | 1 | 1 |
| `Repository Management / group` | 63 | 0 | 1 | 0 | 0 |
| `Repository Management / hosted` | 69 | 2 | 7 | 0 | 0 |
| `Repository Management / proxy` | 75 | 0 | 4 | 0 | 0 |
| `Routing rules` | 5 | 0 | 0 | 0 | 0 |
| `Script` | 6 | 0 | 0 | 4 | 0 |
| `Search` | 6 | 3 | 0 | 1 | 0 |
| `Security management` | 1 | 0 | 0 | 0 | 0 |
| `Security Management: Anonymous Access` | 2 | 0 | 1 | 0 | 0 |
| `Security management: API access` | 1 | 0 | 0 | 0 | 0 |
| `Security management: api keys principals encryption` | 1 | 0 | 0 | 0 | 0 |
| `Security management: LDAP` | 11 | 0 | 1 | 0 | 0 |
| `Security management: privileges` | 15 | 0 | 0 | 0 | 0 |
| `Security management: realms` | 3 | 0 | 0 | 0 | 0 |
| `Security management: roles` | 6 | 0 | 2 | 0 | 0 |
| `Security management: SAML` | 5 | 0 | 0 | 0 | 0 |
| `Security management: SAML users` | 5 | 0 | 0 | 0 | 0 |
| `Security management: SAML users (v2)` | 1 | 0 | 0 | 0 | 0 |
| `Security management: secrets encryption` | 1 | 0 | 0 | 0 | 0 |
| `Security Management: SSRF Protection` | 2 | 0 | 0 | 0 | 0 |
| `Security management: user tokens` | 4 | 0 | 0 | 0 | 0 |
| `Security management: users` | 9 | 0 | 3 | 0 | 0 |
| `Security: Atlassian Crowd` | 4 | 0 | 0 | 0 | 0 |
| `Security: certificates` | 4 | 0 | 0 | 0 | 0 |
| `Security: IP Allow List` | 9 | 0 | 0 | 0 | 0 |
| `Staging` | 2 | 0 | 0 | 0 | 0 |
| `Status` | 5 | 2 | 0 | 0 | 2 |
| `Support` | 2 | 0 | 0 | 0 | 1 |
| `System: Nodes` | 3 | 0 | 0 | 0 | 0 |
| `Tags` | 7 | 0 | 0 | 0 | 0 |
| `Tasks` | 9 | 0 | 0 | 4 | 0 |
| `Usage History` | 1 | 0 | 0 | 0 | 0 |

## Method

- **Denominator.** The frozen census of 442 operations (HTTP method + path template) generated
  from the pinned Sonatype OpenAPI document, version 3.96.3-01, retrieved 2026-11-06; see the
  [inventory](api/inventory.md), its [data](api/inventory.json) and the
  [provenance](product-contract.md#reproducible-specification-provenance).
- **Reachable** means a shipped command issues that exact method and path. It does not measure
  every query parameter, payload field, server version, edition or remote privilege.
- **nexus-cli 0.3.0** was counted from the request paths in `src/` and checked against the
  inventory identities. It equals the reachability of 20 recorded in the
  [delivery plan](milestones.md), which also records the stricter full-contract census: 12
  covered, 8 partial, 422 missing. `content download` reads `/repository/...`, which is outside
  the REST inventory and not counted.
- **nexus3 4.2.1** was measured by reading the published wheel
  (`nexus3_cli-4.2.1-py3-none-any.whl`, SHA-256
  `c41a164e985f4a4f825d582619aaa5f4680b64f9525ed186033e83d50943302a`) without running it. Each
  HTTP call reachable from a `nexus3` command in its default configuration (API version `v1`,
  Groovy scripts enabled) was normalized and matched to the same 442 identities.
- **n3dr 7.6.0** was measured the same way from the tagged source of the GitHub release
  (`https://github.com/030/n3dr/archive/refs/tags/7.6.0.tar.gz`, tag commit
  `672c892809e3fc410af176bfbc18cb63a1367458`, SHA-256 of the archive as downloaded
  `e9f07534e3ade94d362755cb9b75e96db1764e344f750e3b1dc7b0cdefc054cc`, released 2024-12-28)
  without building or running it. 7.6.0 is the latest release that is not a release candidate.
  Every call that a `n3dr` command makes through its generated API client was normalized and
  matched to the same 442 identities.
- **nexus 0.8.0** (`sonatype-nexus-community/nexus-cli`) was measured the same way from the
  tagged source of the GitHub release
  (`https://github.com/sonatype-nexus-community/nexus-cli/archive/refs/tags/v0.8.0.tar.gz`, tag
  commit `14c1ad0d0b99b17c46588c81f24bf3904bc83898`, SHA-256 of the archive as downloaded
  `587d5d72b55a7406a1cf5c2529cfb069577eca3f0cc2e6886201d940310483fd`, released 2020-02-21)
  together with the `gonexus` v0.56.7 library its `go.mod` pins, read from the Go module proxy.
  Only its `nexus rm` commands were measured; the `nexus iq` commands address a different
  product.
- **nexus3-tool 0.7.0** was measured earlier from its PyPI wheel
  (`nexus3_tool-0.7.0-py3-none-any.whl`, SHA-256
  `f06c9e5b32a4482ffd473e3437dce856fe0d02196e93b8f25e4e8a896b841854`). It reaches 7 operations:
  `GET /v1/repositories`, `GET /v1/blobstores`, `GET /v1/components`, `GET /v1/search`,
  `DELETE /v1/components/{id}`, `GET /v1/tasks` and `POST /v1/tasks/{id}/run`. The selection
  rule gives its column to more widely used tools.

## Caveats for the nexus3 column

- It is a static reading of one version, not a statement about later releases.
- Calls made only as a step inside another command (the asset search before a delete or download,
  the script upload before a repository command) are counted as reachable.
- `nexus3 blobstore show` builds its path from the type the server reports
  (`nexuscli/api/blobstore/collection.py:32`). Only the two types the package declares, File and
  S3 (`nexuscli/api/blobstore/model.py:49`), are credited; Azure, Google and group stores are not.
- 4 more operations exist in shipped modules that no `nexus3` command calls (script read, blob
  store quota status, File and S3 blob store update); counting them would give 22 of 442 (5%).
- `nexus3` also issues 9 calls outside this denominator: 4 under `/service/rest/beta/` (realm
  list, active realms, realm activation, repository health check), whose `v1` counterparts in the
  inventory are not credited because the path differs; `HEAD /v1/script/{name}`; a server root
  read for the version; and repository content reads and uploads under `/repository/`, including
  PyPI upload through twine.
- Features it performs by running its own Groovy scripts on the server (repository show, create
  and delete, cleanup policy list, show and create) are credited as `POST /v1/script/{name}/run`,
  not as the dedicated repository or cleanup-policy operations.
- Coverage is one axis. `nexus3` offers things this CLI does not: creating hosted, proxy and
  group repositories for many formats, deleting repositories, cleanup policies, task run and
  stop, script management, blob store create and delete, realm activation, recursive directory
  upload and download, and npm, PyPI and yum uploads.

## Caveats for the n3dr column

- It is a static reading of one version, not a statement about later releases. GitHub lists two
  later release candidates, 7.6.1-rc.1 and 7.6.1-rc.2, both dated 2025-06-28.
- It is a backup, migration and provisioning tool, not a general client: its eight commands are
  `repositoriesV2` (names, count, backup, upload), `sync`, `count`, `config`, `configLDAP`,
  `configRepository`, `configRole` and `configUser`.
- Calls made only as a step inside another command are counted as reachable: the user list and
  the role read are existence checks before a create
  (`internal/app/n3dr/config/user/user.go:65`, `internal/app/n3dr/config/user/user.go:123`), and
  the Maven hosted repository read finds the version policy before a snapshot upload
  (`internal/app/n3dr/artifactsv2/upload/upload.go:794`).
- It lists repositories with `GET /v1/repositorySettings`
  (`internal/app/n3dr/artifactsv2/artifacts/repository.go:24`), so `GET /v1/repositories` is not
  credited.
- Its generated client holds 242 operations, 228 of them in this denominator. Commands call 23;
  the other 205 are in the shipped source with no command, and counting them would give 228 of
  442 (52%). The 14 generated operations outside the denominator (Bower repositories, the
  `/v1/read-only` family, `PUT /v1/security/jwt`) are not called either.
- No command issues a REST call outside this denominator. Backup, checksum comparison and Maven
  snapshot upload also read and write repository content under `/repository/`
  (`internal/app/n3dr/artifactsv2/download.go:38`,
  `internal/app/n3dr/artifactsv2/upload/upload.go:399`,
  `internal/app/n3dr/artifactsv2/upload/maven2/snapshot/upload.go:64`), which is outside the REST
  inventory, as it is for `nexus-cli content download`.
- Coverage is one axis. `n3dr` offers things this CLI does not: backing up every repository of a
  server to disk or a zip and uploading it to another server, repository-to-repository sync,
  creating hosted, proxy and group repositories for apt, Docker, Maven, npm, raw, RubyGems and
  yum, deleting repositories, creating users and roles, changing a password, LDAP setup,
  switching anonymous access, and artifact counts as CSV.

## Caveats for the nexus column (sonatype-nexus-community/nexus-cli)

- It is a static reading of one version, not a statement about later releases. The repository
  is archived; 0.8.0 from 2020-02-21 is its last release. Its README says Sonatype does not
  support it.
- It has seven Nexus Repository commands under `nexus rm`: `repositories list`,
  `components list`, `configure`, `configure read-only enable` and `release`, `support zip` and
  `init`. The rest of the tool is for Sonatype IQ Server.
- Calls made only as a step inside another command are counted as reachable: `components list`
  without arguments reads the repository list first (`cmd/rm_components.go:45`), and the status
  reads run after every `configure` command (`cmd/rm_configure.go:32`, `cmd/rm_configure.go:33`).
- 4 calls match no inventory operation: `GET /v1/read-only` and `POST /v1/read-only/freeze`,
  `/release` and `/force-release` (`cmd/rm_configure.go:35`, `cmd/rm_configure_readonly.go:60`,
  `cmd/rm_configure_readonly.go:62`). The pinned 3.96.3-01 API description has no `/v1/read-only`
  paths, so its read-only commands are not credited.
- The `gonexus` library it links has 17 more inventory operations that no `nexus rm` command
  calls (assets, component read, upload and delete, search, scripts, tag list, read and create);
  counting them would give 22 of 442 (5%).
- Coverage is one axis. It offers things this CLI does not: downloading a support zip and, in the
  same binary, Sonatype IQ Server commands.

## Updating

The README overview, this document and the pictures follow the
[product-readme skill](https://github.com/iXab3r/EyeAuras.CliFactory/tree/main/.claude/skills/product-readme) in Factory; it holds the format, the measuring method and the
picture generator.

- Refresh when the version in a column title changes or the operation inventory changes.
- Edit the numbers in `docs/images/readme-images.json`, then regenerate the four SVGs with the
  skill's script from a Factory checkout:
  `node <factory>/.claude/skills/product-readme/scripts/readme-images.mjs docs/images/readme-images.json docs/images`.
  It prints the area table for this document and rejects columns that do not add up.
- A column for another tool is a dated measurement of one version. Re-measure it deliberately,
  with the skill's method, and update the version, the caveats and the credited list together.

<details>
<summary>The 20 operations reachable from nexus-cli 0.3.0</summary>

- `GET /v1/assets` (ReadOnly)
- `DELETE /v1/assets/{id}` (Update)
- `GET /v1/assets/{id}` (ReadOnly)
- `GET /v1/blobstores` (ReadOnly)
- `GET /v1/blobstores/{name}/quota-status` (ReadOnly)
- `GET /v1/components` (ReadOnly)
- `POST /v1/components` (Update)
- `DELETE /v1/components/{id}` (Update)
- `GET /v1/components/{id}` (ReadOnly)
- `GET /v1/formats/upload-specs` (ReadOnly)
- `GET /v1/formats/{format}/upload-specs` (ReadOnly)
- `GET /v1/repositories` (ReadOnly)
- `POST /v1/repositories/raw/hosted` (Update)
- `GET /v1/repositories/raw/hosted/{repositoryName}` (ReadOnly)
- `GET /v1/repositories/{repositoryName}` (ReadOnly)
- `GET /v1/search` (ReadOnly)
- `GET /v1/search/assets` (ReadOnly)
- `GET /v1/search/assets/download` (ReadOnly)
- `GET /v1/status` (ReadOnly)
- `GET /v1/status/writable` (ReadOnly)

</details>

<details>
<summary>The 23 operations reachable from n3dr 7.6.0</summary>

- `DELETE /v1/repositories/{repositoryName}`
- `GET /v1/components`
- `GET /v1/repositories/maven/hosted/{repositoryName}`
- `GET /v1/repositorySettings`
- `GET /v1/security/roles/{id}`
- `GET /v1/security/users`
- `POST /v1/components`
- `POST /v1/repositories/apt/proxy`
- `POST /v1/repositories/docker/hosted`
- `POST /v1/repositories/maven/group`
- `POST /v1/repositories/maven/hosted`
- `POST /v1/repositories/maven/proxy`
- `POST /v1/repositories/npm/hosted`
- `POST /v1/repositories/npm/proxy`
- `POST /v1/repositories/raw/hosted`
- `POST /v1/repositories/rubygems/hosted`
- `POST /v1/repositories/yum/hosted`
- `POST /v1/repositories/yum/proxy`
- `POST /v1/security/ldap`
- `POST /v1/security/roles`
- `POST /v1/security/users`
- `PUT /v1/security/anonymous`
- `PUT /v1/security/users/{userId}/change-password`

</details>

<details>
<summary>The 18 operations reachable from nexus3 4.2.1</summary>

- `DELETE /v1/assets/{id}`
- `DELETE /v1/blobstores/{name}`
- `DELETE /v1/script/{name}`
- `GET /v1/blobstores`
- `GET /v1/blobstores/file/{name}`
- `GET /v1/blobstores/s3/{name}`
- `GET /v1/repositories`
- `GET /v1/script`
- `GET /v1/search/assets`
- `GET /v1/tasks`
- `GET /v1/tasks/{id}`
- `POST /v1/blobstores/file`
- `POST /v1/blobstores/s3`
- `POST /v1/components`
- `POST /v1/script`
- `POST /v1/script/{name}/run`
- `POST /v1/tasks/{id}/run`
- `POST /v1/tasks/{id}/stop`

</details>

<details>
<summary>The 5 operations reachable from nexus 0.8.0 (sonatype-nexus-community)</summary>

- `GET /v1/components`
- `GET /v1/repositories`
- `GET /v1/status`
- `GET /v1/status/writable`
- `POST /v1/support/supportzip`

</details>
