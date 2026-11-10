# REST coverage comparison

How much of the Sonatype Nexus Repository REST API each tool can call. Measured 2026-11-10.

| Tool | Reachable operations | GET (166) | POST, PUT, DELETE (276) |
|---|---:|---:|---:|
| `nexus-cli` 0.3.0 (this package) | 20 of 442 (5%) | 16 | 4 |
| `nexus3` 4.2.1 (Python `nexus3-cli` from PyPI) | 18 of 442 (4%) | 8 | 10 |
| `nexus3-tool` 0.7.0 (Python `nexus3-tool` from PyPI) | 7 of 442 (2%) | 5 | 2 |

In `nexus-cli` the 16 GET operations are the ReadOnly commands and the other 4 need the Update
grant. `nexus-cli` shares five operations with `nexus3` and five with `nexus3-tool`; two
(`GET /v1/repositories`, `GET /v1/blobstores`) are reachable from all three. Together the three
tools reach 33.

All three tools cover a small part of the API. `nexus-cli` is selected story by story for
artifact work (find, download, publish, delete) and has no server administration commands yet;
the inventory is a census, not a promise to implement every operation.

## By API area

Percent of operations reachable, with the count in brackets.

| API area | Operations | nexus-cli 0.3.0 | nexus3 4.2.1 | nexus3-tool 0.7.0 |
|---|---:|---:|---:|---:|
| Components, assets, upload specs | 9 | 100% (9) | 22% (2) | 22% (2) |
| Search | 6 | 50% (3) | 17% (1) | 17% (1) |
| Repositories: list, inspect, browse | 10 | 20% (2) | 10% (1) | 10% (1) |
| Hosted repository settings | 69 | 3% (2) | 0% (0) | 0% (0) |
| Proxy repository settings | 75 | 0% (0) | 0% (0) | 0% (0) |
| Group repository settings | 63 | 0% (0) | 0% (0) | 0% (0) |
| Blob stores and data store | 23 | 9% (2) | 26% (6) | 4% (1) |
| Status, nodes, support, recovery | 23 | 9% (2) | 0% (0) | 0% (0) |
| Tasks, scripts, capabilities | 20 | 0% (0) | 40% (8) | 10% (2) |
| Cleanup, routing, selectors, tags | 24 | 0% (0) | 0% (0) | 0% (0) |
| Users, roles, privileges, tokens | 39 | 0% (0) | 0% (0) | 0% (0) |
| LDAP, SAML, Crowd, realms | 29 | 0% (0) | 0% (0) | 0% (0) |
| Certificates, encryption, network | 24 | 0% (0) | 0% (0) | 0% (0) |
| Firewall, license, instance config | 28 | 0% (0) | 0% (0) | 0% (0) |
| **All operations** | **442** | **5% (20)** | **4% (18)** | **2% (7)** |

## By inventory group

Reachable operation counts. Groups are the inventory's tracker roots, with the per-format
`Repository Management` roots merged by repository type.

| Resource group | Operations | nexus-cli 0.3.0 | nexus3 4.2.1 | nexus3-tool 0.7.0 |
|---|---:|---:|---:|---:|
| `assets` | 3 | 3 | 1 | 0 |
| `Azure blob store` | 1 | 0 | 0 | 0 |
| `Blob store` | 20 | 2 | 6 | 1 |
| `Capabilities` | 5 | 0 | 0 | 0 |
| `Cleanup policies` | 5 | 0 | 0 | 0 |
| `Community Edition Eula` | 2 | 0 | 0 | 0 |
| `components` | 4 | 4 | 1 | 2 |
| `Content selectors` | 5 | 0 | 0 | 0 |
| `Data Store` | 2 | 0 | 0 | 0 |
| `Email` | 4 | 0 | 0 | 0 |
| `Formats` | 2 | 2 | 0 | 0 |
| `Instance configuration` | 7 | 0 | 0 | 0 |
| `Internal UI: API permissions` | 1 | 0 | 0 | 0 |
| `Lifecycle` | 3 | 0 | 0 | 0 |
| `Malicious Risk On Disk` | 2 | 0 | 0 | 0 |
| `Manage Sonatype HTTP System Settings` | 3 | 0 | 0 | 0 |
| `Manage Sonatype Repository Firewall configuration` | 11 | 0 | 0 | 0 |
| `Monthly Metrics` | 1 | 0 | 0 | 0 |
| `Product licensing` | 3 | 0 | 0 | 0 |
| `Reconcile Plan` | 9 | 0 | 0 | 0 |
| `Recovery Mode` | 2 | 0 | 0 | 0 |
| `Repository Browse` | 2 | 0 | 0 | 0 |
| `Repository Management / General` | 8 | 2 | 1 | 1 |
| `Repository Management / group` | 63 | 0 | 0 | 0 |
| `Repository Management / hosted` | 69 | 2 | 0 | 0 |
| `Repository Management / proxy` | 75 | 0 | 0 | 0 |
| `Routing rules` | 5 | 0 | 0 | 0 |
| `Script` | 6 | 0 | 4 | 0 |
| `Search` | 6 | 3 | 1 | 1 |
| `Security management` | 1 | 0 | 0 | 0 |
| `Security Management: Anonymous Access` | 2 | 0 | 0 | 0 |
| `Security management: API access` | 1 | 0 | 0 | 0 |
| `Security management: api keys principals encryption` | 1 | 0 | 0 | 0 |
| `Security management: LDAP` | 11 | 0 | 0 | 0 |
| `Security management: privileges` | 15 | 0 | 0 | 0 |
| `Security management: realms` | 3 | 0 | 0 | 0 |
| `Security management: roles` | 6 | 0 | 0 | 0 |
| `Security management: SAML` | 5 | 0 | 0 | 0 |
| `Security management: SAML users` | 5 | 0 | 0 | 0 |
| `Security management: SAML users (v2)` | 1 | 0 | 0 | 0 |
| `Security management: secrets encryption` | 1 | 0 | 0 | 0 |
| `Security Management: SSRF Protection` | 2 | 0 | 0 | 0 |
| `Security management: user tokens` | 4 | 0 | 0 | 0 |
| `Security management: users` | 9 | 0 | 0 | 0 |
| `Security: Atlassian Crowd` | 4 | 0 | 0 | 0 |
| `Security: certificates` | 4 | 0 | 0 | 0 |
| `Security: IP Allow List` | 9 | 0 | 0 | 0 |
| `Staging` | 2 | 0 | 0 | 0 |
| `Status` | 5 | 2 | 0 | 0 |
| `Support` | 2 | 0 | 0 | 0 |
| `System: Nodes` | 3 | 0 | 0 | 0 |
| `Tags` | 7 | 0 | 0 | 0 |
| `Tasks` | 9 | 0 | 4 | 2 |
| `Usage History` | 1 | 0 | 0 | 0 |

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
- **nexus3-tool 0.7.0** was measured the same way from the published wheel
  (`nexus3_tool-0.7.0-py3-none-any.whl`, SHA-256
  `f06c9e5b32a4482ffd473e3437dce856fe0d02196e93b8f25e4e8a896b841854`, uploaded to PyPI
  2026-07-02) without running it. Every HTTP call reachable from a `nexus3-tool` command was
  normalized and matched to the same 442 identities.

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

## Caveats for the nexus3-tool column

- It is a static reading of one version, not a statement about later releases. PyPI lists eight
  releases between 2026-03-06 and 2026-07-02 and classifies the package as Beta.
- It is a Docker image cleanup tool, not a general Nexus client: its ten commands are `login`,
  listing Docker repositories and images, inspecting a tag, finding duplicate tags, planning and
  running prunes, deleting tags and running a cleanup task. The low number reflects that scope.
- Calls made only as a step inside another command are counted as reachable: `login` checks the
  credentials with the repository list (`nexus3_tool/client.py:284`), and `list-docker-images`
  and `delete-docker-images` read the blob store list for free space (`nexus3_tool/cli.py:699`,
  `nexus3_tool/cli.py:878`, `nexus3_tool/client.py:312`).
- A single repository or blob store is found by filtering the list response
  (`nexus3_tool/client.py:291`, `nexus3_tool/client.py:314`), and `run-cleanup-task --wait`
  polls the task list (`nexus3_tool/cli.py:1376`). The per-item operations
  `GET /v1/repositories/{repositoryName}`, the typed blob store reads and `GET /v1/tasks/{id}`
  are therefore not credited.
- No inventory operation exists in the shipped modules without a command calling it, and no
  command issues a call outside this denominator. The package has no `/service/rest/beta/`
  calls and no Groovy scripts.
- One call outside the denominator exists in the client but is not wired to a command: reading
  Docker manifests through the asset download URL to sum layer sizes
  (`nexus3_tool/client.py:327`). The command module computes sizes from component metadata
  instead (`nexus3_tool/cli.py:278`).
- Coverage is one axis. `nexus3-tool` offers things this CLI does not: Docker tag retention
  (keep the last N, older-than, protected tags and a protected image list, include and exclude
  patterns) with a dry run and a plan preview, deleting tags together with their same-manifest
  aliases, duplicate tag detection, and starting a server cleanup task and waiting for it.

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
<summary>The 7 operations reachable from nexus3-tool 0.7.0</summary>

- `DELETE /v1/components/{id}`
- `GET /v1/blobstores`
- `GET /v1/components`
- `GET /v1/repositories`
- `GET /v1/search`
- `GET /v1/tasks`
- `POST /v1/tasks/{id}/run`

</details>
