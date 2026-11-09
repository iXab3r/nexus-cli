# Build and staged npm releases

This implementation follows [opensearch-cli](https://github.com/iXab3r/opensearch-cli/tree/d01560508901e8169fb1386535ecc5fba9f1a7f3)
at commit `d01560508901e8169fb1386535ecc5fba9f1a7f3`: .NET 10, Cake Frosting 6.3.0,
`build/teamcity.sh`, main-only Verify and manual npm staging. Node 22.14+ and the exact
`packageManager` npm version are required. TeamCity uses `node:24-bookworm` on Linux.
The build project pins Cake's transitive PKCS dependency to patched 10.0.13; see
[Microsoft's advisory](https://github.com/dotnet/announcements/issues/468).
No new Nexus license grant is made by the release metadata. [build/NOTICE](../build/NOTICE)
preserves the reused template's MIT notice without selecting a product license.

## Current adoption gate

The current release is **`@eyeauras/nexus-cli@0.2.0`**, published as npm `latest`,
with the matching [GitHub Release](https://github.com/iXab3r/nexus-cli/releases/tag/v0.2.0).
It includes the accepted M7–M9 changes: known-store quota status, exact int64 metadata
and the complete pinned scalar search selectors. The executable reads its version
from package.json. [Publication evidence](https://github.com/iXab3r/nexus-cli/pull/667#issuecomment-6727401540)
records owner 2FA approval, successful registry-installed checks and the verified
archive/manifest at source commit `7b2352e627740c13668aebad33e65163220234e2`.
Future stages still require owner approval on npm before publication.

## 0.3.0 release scope

The next release candidate is **0.3.0**, containing accepted M10 and M11:
exact optional repository sizes, sanitized repository/upstream URL projections,
and complete upload-field explanations and choices. These extend existing commands;
they do not add another authentication protocol or package-format uploader.
The published version remains 0.2.0 until the candidate's verified npm stage receives
owner 2FA approval and VerifyRegistry completes.

The release checks exercise these existing user workflows:

| Workflow | Verification boundary |
|---|---|
| Noninteractive CI | Installed Bash recipe: isolated profile, stdin Basic pair, Update gate, raw upload, digest-checked download, fail-fast behavior and local logout |
| Authentication | Basic and explicit anonymous modes, profile isolation, secure-store failure, rejected credentials and redacted errors |
| Find and download | Component/asset reads, scalar search selectors, bounded pagination, asset/search/direct-content transfers and safe file publication |
| Publish | Raw REST upload and Maven generated-POM/original-POM companion workflows; acknowledgment and unknown-outcome handling |
| Automation output | The shared command tree in human, JSON and persistent JSON-RPC modes |
| New metadata | Repository sizes/upstream projection and complete upload-field metadata in the installed executable |

Service tests are offline with synthetic HTTP and secret-store boundaries. They do
not certify a live Nexus version/edition or provision a runner's native secure store.
Linux CI needs a working Secret Service/keyring session; there is no plaintext
credential fallback. Native npm/NuGet/Maven/Docker/Python package-manager protocols
remain the responsibility of those clients; REST publication here supports raw/Maven.

Local release qualification uses Node 24 and the pinned npm version, matching CI's
Node major. Earlier full installed-package attempts on Node 26 timed out at help,
although compiled help and an isolated installed help/version probe succeeded.
That harness limitation remains unqualified and is not a claim of a failing or
passing full installed Node 26 workflow.

The manifest and lock now pin published Core **0.6.1**, with instruction links at
release commit `c313194f8cd22547dae6ae8693a2771f3a5066f0`. Its freshly downloaded
registry archive matches the official GitHub release archive and manifest: SHA-1
`d0d5413f329f8d259b000117f1270aaa5f641fbf`, with matching SHA-512 lock integrity.
The earlier M5/M6 local-overlay receipts remain historical evidence only.

Published-Core adoption passed the full clean local Verify, Pack and DryRun gates
on 2026-11-07: each ran all 435 runtime tests and 2 release-safety tests with zero
failures or skips. The unchanged standard `test:package` passed after registry
installation and again against the exact 14-file release archive. Pack and DryRun
produced identical archive bytes and a `dry-run-verified` receipt. No ignored runner
or local overlay qualified these results. Each release revision requires these
gates again; fresh final review, TeamCity verification and staged publication
remain delivery-lead gates.

## Local driver

```sh
dotnet run --project build -- --target Verify
dotnet run --project build -- --target SetVersion --release-version 0.1.0
RELEASE_REVISION=$(git rev-parse HEAD) dotnet run --project build -- --target Pack --release-version 0.1.0 --dry-run
RELEASE_REVISION=$(git rev-parse HEAD) dotnet run --project build -- --target DryRun --release-version 0.1.0 --dry-run
```

Verify performs `npm ci`, the existing offline `npm test`, installed-package smoke,
and the release safety test. Dependency installation uses the registry; CLI service
operations use only synthetic offline boundaries. No live Nexus test runs in CI.
Pack also runs Verify and writes `output/release/` with the archive and
`release-manifest.json` (name, version, commit, filename, SHA-1 and SHA-512 integrity).
It then installs and tests that exact tarball, including its executable archive allowlist,
executable version, human/JSON/RPC flows, synthetic transfers and CI recipe. Core
must resolve within the temporary installed prefix. Tests/source/build tooling are
excluded from the archive.

Every release target checks the requested version against package.json and both
lockfile version sites. `RELEASE_REVISION` must equal the full checkout SHA. Live
modes require a clean tree; Stage additionally requires the current remote main tip.
DryRun calls only `npm publish --dry-run`. Release runs the same staged path as
Stage, or the dry-run path with `--dry-run`; neither approves npm publication.
`Stage --dry-run` is rejected. Cake's separate `--dryrun` only prints a task plan.
`--exclusive` skips task dependencies and is only for a reviewed recovery; it is
not a replacement for Verify/Pack evidence.

Use LF for package text and emitted JavaScript. Different Node/zlib versions can
produce different gzip bytes even when the decompressed tar is identical, as observed
between the local Node 26 and CI Node 24 archives for 0.2.0. The tested CI archive is
the canonical release artifact: compare its exact SHA-512 through DryRun, Stage and
VerifyRegistry, and do not substitute a local repack.
`npm run test:package -- --tarball /absolute/archive.tgz` checks a supplied archive;
`npm run test:registry -- 0.1.0` fetches and tests the registry archive instead.
Both use disposable npm config/cache/prefix and isolated CLI AppData.

## TeamCity cutover

Proposed identities (not a claim that server configuration has been applied):

| Object | ID |
|---|---|
| Project under EyeAuras | `EyeAuras_NexusCli` |
| Public anonymous Git root, refs/heads/main only | `EyeAuras_NexusCli_Repo` |
| Verify | `EyeAuras_NexusCli_Verify` |
| Manual staging / registry verification | `EyeAuras_NexusCli_NpmStage` |
| Exclusive release resource | `nexus-cli-release` |

Use installed `@eyeauras/teamcity-cli`, not the removed JetBrains CLI. The simplest
setup is its native server-side `jobs copy`: copy OpenSearch Verify and NpmStage
into the new project, preserving the protected npm binding without reading it.
The source jobs are `EyeAuras_OpenSearchCli_Verify` and
`EyeAuras_OpenSearchCli_NpmStage`. Copy while the new project is archived, pause
both copies and disable the copied Verify trigger before changing their VCS roots.
Replace the root attachments with `EyeAuras_NexusCli_Repo`; do not alter the shared
OpenSearch root. Keep `RUNNER_1`, the Linux requirement and Docker settings; its
script is `bash build/teamcity.sh`. Replace the copied release lock with
`nexus-cli-release writeLock`, backed by a new project quota-one Shared Resource.
The Verify trigger remains disabled until the entry point is merged to main and
manual Verify passes. The release job has no trigger or upstream dependencies.

The bootstrap installs .NET 10 in temporary storage and pinned npm, then invokes
Cake. It does **not** create/update TeamCity configuration. No staging build in
this source bootstraps server settings. Native CLI configuration suffices; manual
REST and a new CI configuration framework are unnecessary.

Preserve the copied `env.NPM_TOKEN=%npm.token%` reference and protected `npm.token`.
`env.GITHUB_TOKEN` is inherited as a protected parameter from EyeAuras. Never read,
resolve, dump, embed or supply either credential as a queue parameter. Ensure the
existing protected bindings permit the new package/repository before live staging.
No Git credential is required for the public anonymous source root.

The wrapper admits only named system/tool variables before bootstrap and passes only
the selected token into Cake. Cake independently admits only named system/tool variables
and creates empty private npm user/global configs for ordinary npm children. It passes
npm auth only to staging, and writes GitHub authorization to a private temporary
header file. Temporary auth files stay outside the checkout and are removed on exit.
TeamCity receives `output/release/* => npm-release.zip`, including on failure after
archive/receipt creation. Each release run removes old release output first.

## Release and recovery

After the Core gate, independent review, configuration cutover and merge, select
one exact main commit as `<sha>`. Unpause the jobs only when ready to run them.
The copied staging job requires a one-off `release.build` label. Version and
checkout selection come from source and TeamCity, not that label.

```sh
teamcity-cli jobs run EyeAuras_NexusCli_Verify --wait --timeout 30m
teamcity-cli jobs run EyeAuras_NexusCli_NpmStage --param env.RELEASE_MODE=--dry-run --param env.RELEASE_REVISION=<sha> --param release.build=0.1.0-dry-run
teamcity-cli jobs run EyeAuras_NexusCli_NpmStage --param env.RELEASE_MODE=--stage --param env.RELEASE_REVISION=<sha> --param release.build=0.1.0-stage
# Owner approves the exact verified stage on npm with 2FA before this command:
teamcity-cli jobs run EyeAuras_NexusCli_NpmStage --param env.RELEASE_MODE=--verify-registry --param env.RELEASE_REVISION=<sha> --param release.build=0.1.0-verify
```

Omit `--branch`. `RELEASE_REVISION` checks the checkout; it does not select a commit.
If main advances, select the original revision in TeamCity custom build settings
for registry verification. Keep the same archive bytes and manifest throughout.

DryRun produces `dry-run-verified`. Stage refuses an existing stage of this version,
saves `staged-unverified` with the stage ID before verification, downloads the stage
and compares SHA-512, then produces `awaiting-2fa-approval`. Retain npm-release.zip.
Only the owner approves the identified stage in npm Staged Packages with 2FA.
Never approve `staged-unverified`, the `0.0.0-stage` placeholder, or a different ID.

VerifyRegistry requires matching registry version, latest tag and integrity, then
runs the registry-installed offline smoke. Only afterward does it create GitHub
Release `v0.1.0` at the packed commit with archive and manifest and write
`published-verified`. An existing tag on another commit or asset with different
bytes fails. Matching existing assets are retained; missing assets can be resumed.
These are source/archive provenance records, not npm OIDC attestations.

After a lost stage response, inspect `npm stage list @eyeauras/nexus-cli --json`
before any retry. No task approves/rejects a stage, unpublishes a package or deletes
a release. On E403/E404, inspect access with the owner before retrying; do not widen
token permissions or disable 2FA. See [npm staged publishing](https://docs.npmjs.com/staged-publishing/).
