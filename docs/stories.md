# Approved user stories

Every command below is prefixed with `nexus-cli`. The shared acceptance contract in product-contract.md and exact source/output contracts in source-contracts.md are part of every story below. S01–S23 and their order are approved; S24 retains its stable identity but is deferred. Tracker relationships must be verified separately. Profile/auth flags specific to Basic are proposed integration declarations, not claims of existing framework flags. All stories support Core human/JSON output and the same command tree in RPC. Secret stdin is unavailable in RPC; configure separately with the packaged CLI.

## Shared acceptance matrix (part of every story)

Given valid input and a permitted target, when the example runs, then the stated result appears and exit is 0. Given denied local gate, no service call occurs; given server 401/403, exit 1 with Core http.unauthorized/http.forbidden and no success result. All service reads/downloads are ReadOnly; mutations are Update disabled by default. Server repository-view browse/read, upload/edit/delete or repository-admin rights remain separately required; list visibility may be filtered rather than denied. No category grants remote rights.

Given malformed input, fail before side effects with Core usage behavior; transport/decode/server errors exit 1 with contextual stable codes, retained causes, redacted secrets and no response-body dump. Empty collections are successful; absent singular resources fail. Given partial pagination/transfer/mutation uncertainty, apply the story-specific rule rather than success. Single-response reads have no partial result; local profile/auth operations have no server mutation. Every story must verify stdout data vs stderr diagnostics in packaged human/JSON execution and representative RPC envelope. These scenarios plus each story's specifics form the required Given/When/Then acceptance set.

## S01 — Configure a connection

As a operator, I want to configure a connection.

```sh
nexus-cli profile configure lab --url https://nexus.example.test:443/nexus --credentials-stdin
```

- Observable result: profile name, preserved URL and access-probe status.
- Acceptance: Malformed/rejected pair or storage failure leaves no success; denied probe alone does not reject a structurally valid pair; no secret in profile JSON. Probe cannot prove identity if anonymous allowed.
- Permissions and boundaries: Local profile lifecycle; Basic pair JSON on stdin is proposed adapter syntax.
- Required operation identities: custom AuthDefinition; listRepositories (access probe proposal). Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S02 — Switch isolated environments

As a operator, I want to switch isolated environments.

```sh
nexus-cli repositories list --profile lab
```

- Observable result: only selected profile repositories.
- Acceptance: Given two profiles, alternating RPC calls use distinct credentials and URLs; missing profile fails before HTTP.
- Permissions and boundaries: No environment cloning or shared credentials.
- Required operation identities: listRepositories. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S03 — Inspect and clear credentials

As a operator, I want to inspect and clear credentials.

```sh
nexus-cli auth status --profile lab
nexus-cli auth logout --profile lab
```

- Observable result: credential presence and access verification; logout acknowledgment.
- Acceptance: Report absent/anonymousConfigured/storedUnverified and independent probe outcome; logout is local only and does not revoke server tokens.
- Permissions and boundaries: Do not assert principal identity or token revocation.
- Required operation identities: AuthDefinition status/logout; listRepositories proposed probe. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S04 — Inspect public repositories

As a anonymous reader, I want to inspect public repositories.

```sh
nexus-cli profile configure public --url https://nexus.example.test --auth-mode anonymous
nexus-cli repositories list --profile public
```

- Observable result: visible repositories and explicit anonymous mode.
- Acceptance: Given anonymous disabled, request fails 401/403 without prompting in JSON mode.
- Permissions and boundaries: Explicit opt-in; never fall back from failed Basic to anonymous.
- Required operation identities: listRepositories. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S05 — Check service availability

As a operator, I want to check service availability.

```sh
nexus-cli status
```

- Observable result: readable/writable indicators.
- Acceptance: Given 503, report unavailable exit 1; connection/TLS failures retain classified cause; status is not login proof.
- Permissions and boundaries: No privileged health/support bundle collection.
- Required operation identities: listStatus; listStatusWritable. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S06 — List visible repositories

As a reader, I want to list visible repositories.

```sh
nexus-cli repositories list
```

- Observable result: name, format, type, URL, online.
- Acceptance: Given zero visible repositories, return empty list exit 0; never interpret that as full installation inventory.
- Permissions and boundaries: Visibility is server-authorized, no admin escalation.
- Required operation identities: listRepositories. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S07 — Inspect one repository

As a reader, I want to inspect one repository.

```sh
nexus-cli repositories get releases
```

- Observable result: single repository summary.
- Acceptance: Given absent name, 404 exit 1; quote/encode names safely.
- Permissions and boundaries: Summary only; format configuration is S22.
- Required operation identities: getRepositories. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S08 — Browse components

As a reader, I want to browse components.

```sh
nexus-cli components list --repository releases
```

- Observable result: items and continuationToken, complete flag.
- Acceptance: Given a page, emit exactly page plus token; empty page with token is not end.
- Permissions and boundaries: Default one page, no guessed total.
- Required operation identities: listComponents. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S09 — Inspect a component and its files

As a reader, I want to inspect a component and its files.

```sh
nexus-cli components get COMPONENT_ID
```

- Observable result: coordinates and associated assets.
- Acceptance: Given nonexistent ID, 404 exit 1; opaque ID is never decoded to construct paths.
- Permissions and boundaries: No automatic downloads.
- Required operation identities: getComponents. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S10 — Browse repository assets

As a reader, I want to browse repository assets.

```sh
nexus-cli assets list --repository releases
```

- Observable result: asset ID/path/size/checksum metadata and continuationToken.
- Acceptance: Given zero assets, empty list exit 0; malformed JSON fails decoding.
- Permissions and boundaries: No filesystem writes.
- Required operation identities: listAssets. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S11 — Inspect one asset

As a reader, I want to inspect one asset.

```sh
nexus-cli assets get ASSET_ID
```

- Observable result: download URL, path and checksums.
- Acceptance: Given missing asset, 404 exit 1; unsafe URL credentials are redacted.
- Permissions and boundaries: Metadata is not a download or integrity verification.
- Required operation identities: getAssets. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S12 — Find a component by coordinates

As a developer, I want to find a component by coordinates.

```sh
nexus-cli search components --repository releases --name widget --artifact-version 1.0
```

- Observable result: matching components plus next token.
- Acceptance: Given no matches, empty success; invalid filter fails locally or with server rejection, never silently drops filter.
- Permissions and boundaries: Allowlist documented filters; no invented wildcard semantics.
- Required operation identities: listSearch. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S13 — Select a particular artifact

As a developer, I want to select a particular artifact.

```sh
nexus-cli search assets --repository releases --name widget --maven-extension jar --maven-classifier ""
```

- Observable result: matching asset metadata and continuation token.
- Acceptance: Given empty classifier, query preserves empty value; zero matches succeeds; server error fails.
- Permissions and boundaries: No local version sort or automatic first match selection.
- Required operation identities: listSearchAssets. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S14 — Enumerate safely and resume

As a automation author, I want to enumerate safely and resume.

```sh
nexus-cli assets list --repository releases --all --max-pages 100
nexus-cli assets list --repository releases --continuation-token TOKEN
```

- Observable result: items, pagesFetched, complete, continuationToken.
- Acceptance: Given page two failure, partial items exit 1 complete=false; repeated token fails; cap yields noncomplete exit 1; final null token completes exit 0.
- Permissions and boundaries: No consistency snapshot guarantee; apply policy to four paged read commands.
- Required operation identities: listAssets; listComponents; listSearch; listSearchAssets. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S15 — Download a known asset with integrity check

Assignment: see [approved milestones](milestones.md).

As a developer, I want to download a known asset with integrity check.

```sh
nexus-cli assets download ASSET_ID --output ./widget.jar --sha256 EXPECTED
```

- Destination defaults to invocation cwd with a safe asset basename; `--output` may be relative or absolute. No implicit profile files.
- Observable result: destination, byte count, computed digest, verified flag.
- Acceptance: Given matching digest, atomically finalize; mismatch/interruption/disk full exits 1 and reports actual cleanup/published state; existing destination fails; missing body never produces final file.
- Permissions and boundaries: ReadOnly remote category; explicit local write; no resume/overwrite in initial scope.
- Required operation identities: getAssets; GET returned downloadUrl (outside OpenAPI). Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S16 — Download a uniquely selected search result

Assignment: see [approved milestones](milestones.md).

As a developer, I want to download a uniquely selected search result.

```sh
nexus-cli search download --repository releases --name widget --artifact-version 1.0 --output ./widget.jar
```

- Destination defaults to invocation cwd with the safe final target basename; optional `--output` may be relative or absolute. No implicit profile files.
- Observable result: destination and bytes; integrity unavailable unless expected checksum provided.
- Acceptance: Given 302 follow scoped redirects; 400 ambiguity/404 absent exits 1 without file; Core same-host HTTP-to-HTTPS credential continuity (including non-default ports), unrelated-origin stripping, loop rejection and HTTPS downgrade rejection tested.
- Permissions and boundaries: No arbitrary first hit; never forward credentials to unrelated origin.
- Required operation identities: listSearchAssetsDownload; GET redirect target (outside OpenAPI). Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S17 — Discover upload requirements

As a publisher, I want to discover upload requirements.

```sh
nexus-cli formats upload-specs get raw
```

- Observable result: format fields, optional flags and multipleUpload.
- Acceptance: Given unsupported format, report actual server status; no endpoint availability diagnosis from 404 alone.
- Permissions and boundaries: Inspection does not imply CLI supports publishing every returned format.
- Required operation identities: getFormatsUploadSpecs. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S18 — Publish a raw file

Assignment: see [approved milestones](milestones.md).

As a publisher, I want to publish a raw file.

```sh
nexus-cli components upload raw --repository raw-releases --directory releases/1.0 --file ./widget.zip --filename widget.zip
```

- Observable result: upload acknowledgment and repository; no invented component ID.
- Acceptance: Given valid hosted target, multipart raw.directory/raw.asset1/raw.asset1.filename gets source-confirmed 204 (pinned ComponentsResource.uploadComponent; OpenAPI omits this success response); missing file fails preflight; uncertain transport exits 1 unknown outcome with no retry.
- Permissions and boundaries: Update; REST authorization chain is in source-contracts.md; no group/proxy upload.
- Required operation identities: createComponents. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S19 — Publish maven coordinates

Assignment: see [approved milestones](milestones.md).

As a publisher, I want to publish Maven coordinates.

```sh
nexus-cli components upload maven --repository maven-releases --group com.example --artifact widget --artifact-version 1.0 --file ./widget.jar --extension jar
```

- Observable result: publication acknowledgment.
- Acceptance: Given valid fields, send maven2 multipart fields; rejected redeploy returns server error; partial/unknown outcome never claims rollback; missing coordinates/file fail before POST.
- Permissions and boundaries: Update; one uploaded JAR with explicit server-generated POM; POM inference, classifiers and multi-asset expansion require explicit acceptance before addition.
- Required operation identities: createComponents. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S20 — Remove a single unwanted asset

As a maintainer, I want to remove a single unwanted asset.

```sh
nexus-cli assets delete ASSET_ID --confirm-id ASSET_ID
```

- Observable result: deleted asset ID after 204.
- Acceptance: Given mismatched confirmation, zero mutation; 404 exits 1 rather than claimed deletion; timeout unknown outcome, no replay.
- Permissions and boundaries: Update plus repository delete right; deletion may affect component usefulness; no blob reclamation guarantee.
- Required operation identities: getAssets; deleteAssets. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S21 — Remove a component and its assets

As a maintainer, I want to remove a component and its assets.

```sh
nexus-cli components delete COMPONENT_ID --confirm-id COMPONENT_ID
```

- Observable result: deleted component ID and previously observed asset count.
- Acceptance: Given confirmation, one DELETE; 403 no success; timeout unknown outcome; observed asset count is preflight information, not atomic proof.
- Permissions and boundaries: Update plus repository delete right; no bulk deletion or undo guarantee.
- Required operation identities: getComponents; deleteComponents. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S22 — Inspect raw hosted settings

Assignment: see [approved milestones](milestones.md).

As a repository administrator, I want to inspect raw hosted settings.

```sh
nexus-cli repositories hosted raw get raw-releases
```

- Observable result: online/storage/writePolicy configuration with sensitive fields excluded.
- Acceptance: Given non-raw/absent repository, report actual response; lack of admin rights fails, not downgraded summary.
- Permissions and boundaries: ReadOnly; repository-admin read permissions; no credential-bearing proxy settings.
- Required operation identities: getRepositoriesRawHosted. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S23 — Create raw hosted repository

Assignment: see [approved milestones](milestones.md).

As a repository administrator, I want to create raw hosted repository.

```sh
nexus-cli repositories hosted raw create raw-releases --blob-store default --write-policy ALLOW_ONCE --online true --strict-content-type-validation true
```

- Observable result: created repository name after 201.
- Acceptance: Given valid existing blob store, create; absent blob store fails; duplicate/invalid name reports server rejection; timeout unknown outcome no retry.
- Permissions and boundaries: Update; repository-admin create; existing blob store only, no default server policy guessed beyond supplied fields.
- Required operation identities: createRepositoriesRawHosted. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.

## S24 — DEFERRED: Change explicit raw hosted settings

Assignment: see [approved milestones](milestones.md).

As a repository administrator, I want to change explicit raw hosted settings.

```sh
nexus-cli repositories hosted raw update raw-releases --online false
```

- Observable result: acknowledged requested changes after 204.
- Acceptance: Given read configuration, preserve supported effective settings through the explicit projection in source-contracts.md; reject unknown/non-default unsupported fields before PUT; 400/403 fail; concurrent update cannot be promised safe without server precondition support; timeout unknown outcome.
- Permissions and boundaries: Update; repository-admin edit; bounded online/writePolicy only; concurrency limitation requires explicit owner acceptance.
- Required operation identities: getRepositoriesRawHosted; updateRepositoriesRawHosted. Resolve against inventory.json; external content GET is explicitly not an OpenAPI operation.


## Source-closed acceptance additions

S15/S16: retain --output and no overwrite; delivery depends on separately approved additive Core publishFile seam, not fake AppData. Include initial URL origin validation, redirect chain stripping, byte/length/hash validation and truthful cleanup outcomes from product-contract.md.

S18: repository browse/read admission and path EDIT are separate server checks; model selector denial before write. S19: explicitly send generation=true and packaging=jar; generated POM and checksum assets do not have a separate selector check in the pinned path. Report acknowledged upload, never exact one-asset creation or atomic rollback; recommend repository-level edit for this supported workflow.

S22: show storage, cleanup, component and raw effective configuration from concrete adapter. S23 uses explicit defaults from source-contracts.md. S24 preserves supported effective settings only; legacy null can normalize to INLINE; no optimistic concurrency guarantee. Scope remains online/writePolicy change, not arbitrary configuration editing.
