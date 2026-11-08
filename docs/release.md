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

The first release `@eyeauras/nexus-cli@0.1.0` is published on npm, with the matching
[GitHub Release](https://github.com/iXab3r/nexus-cli/releases/tag/v0.1.0).
The executable reads the version from package.json. The next release candidate is
**0.2.0**, incorporating the accepted M7–M9 changes: known-store quota status, exact
int64 metadata and the complete pinned scalar search selectors. A prepared candidate
is not a published version; Stage still requires owner approval on npm.

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

Use LF for package text and emitted JavaScript so the same commit repacks identically.
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
