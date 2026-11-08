# Depot package-hosting CLI

Owner direction, 2026-11-08: `nexus-cli` is the CLI for EyeAuras.Depot, a package-hosting
product with deliberately bounded Nexus compatibility. The product does not aim to reproduce
Sonatype Nexus. This direction supersedes the earlier universal-Nexus/no-Depot restriction.
The task/disposition update is recorded in [CLI #637](https://github.com/iXab3r/nexus-cli/issues/637).

## Task selection

The authoritative scope ledger is [depot-scope.json](api/depot-scope.json), tied to the unchanged
Nexus 3.96.3-01 source hash. The complete [API inventory](api/inventory.md) remains a reference
census. Its presence, an open operation, a shared name or existing Nexus test never authorizes work.

| Disposition / issue label | Meaning for delivery |
|---|---|
| `candidate` / `depot:candidate` | Shared business need to assess in a Depot story; not an approved endpoint/DTO/auth mapping or an implementation-ready task |
| `excluded` / `depot:excluded` | Do not port this Nexus/Sonatype mechanism under current scope |
| `deferred` / `depot:deferred` | Explicitly deferred general capability; no active milestone |
| `outside-scope` / `depot:outside-scope` | General capability not selected for Depot; no future commitment |

Scoped-out open operations close as **NOT_PLANNED**, with the owner's disposition and reason.
They are not delivered coverage. Historical completed operations/stories keep their original
state/reason and evidence even when their new applicability is outside scope. API parents report
child dispositions; closing a mixed/excluded parent is not a claim that all Nexus operations exist.
Keep original identities, labels, assignees, native parent/dependency links and source facts.

Only an owner-selected user story with exact API dependencies, resolved contracts, an approved
milestone and independent design/security review can enter implementation. An API-candidate view
is a contract-reference view. Reopening an exclusion or selecting an additional format, backend,
provider, infrastructure/admin feature requires an explicit owner scope decision. Inventory
regeneration and tracker sync must preserve these dispositions and must not reopen excluded work.
New upstream operations default to unselected until assessed; a new spec pin is not scope approval.

## Package-hosting boundary

Depot's current formats are npm, NuGet, Cargo and versioned generic artifacts. Hosted repositories,
package/version/files, permission-filtered discovery, safe download, publication and explicit
whole-version/package removal supply the relevant workflows. Each format retains its native
identity, validation and client behavior; one universal REST upload is not assumed.

Keep immutable published versions/manifests, atomic visibility and documented durability, occupied
published coordinates, and independent current Read/Write/Delete. A file DELETE must not mutate a
committed manifest. Public access is per repository; current local policy still governs tokens.
Do not require Read from a Write-only publisher or Delete-only caller by accident. Existing CLI
preflight Read versus Depot Delete-without-Read must be resolved explicitly before claiming support.

Nexus Raw is a reference for byte hosting, not an alias for Depot artifacts: Nexus supports
write policies, while Depot has package/version identity and atomic multi-file finalization.
Nexus general tags differ from npm dist-tags; promotion differs from unpublished upload/finalize;
installation/cluster nodes differ from logical Chiral owners. Existing Local/S3 control and
health/capacity needs do not select named per-repository blobstores/groups or hot backend swaps.

Do not select Sonatype licensing/EULA/IQ/Firewall, Groovy/capabilities/JVM lifecycle, Nexus migration,
reconciliation/realm/CSEL/wildcard/encryption machinery or cluster administration. Proxy/groups,
cleanup/general scheduling remain deferred. Maven and other extra formats, extra auth providers,
storage backends and unrelated admin/analytics features remain unselected unless explicitly scoped.
Ordinary password users, hard user deletion, delegated repository administration, role inheritance,
expiry-disable switches and arbitrary asset/folder deletion are not implied by a similar Nexus DTO.

## Current evidence and next drafts

Published v0.1.0 and historical S01–S30 are a Nexus baseline. Preserve existing commands until a
reviewed replacement migrates consumers; this scope update removes no runtime behavior and claims
no qualified Depot support. Historical Maven support is not a Depot format decision. S24 and
Nexus-edition/realm token administration S31 are outside the current Depot plan.

The [S32–S35 drafts](stories.md#current-depot-drafts) cover connection, read/download, publication
and whole-version removal.
They stay unmilestoned and contract-blocked under
[Depot #210](https://github.com/iXab3r/EyeAuras.Depot/issues/210). Concrete syntax/route/DTO/format
selection and dependencies must be settled there before implementation. Tests must include the
packaged CLI against Depot; Nexus-only mocks or a green native client cannot prove that pairing.

Use an existing Depot access JWT from its accepted acquisition flow. The present CLI sends Basic;
Depot management accepts cookie/Bearer. Exact transport and secret handling are contract work,
not permission to introduce another token issuer, verifier, credential database, login flow or
silent auth fallback. Keep Identity/OpenIddict and current server authorization owners intact.
ReadOnly/Update gates are local admission, never proof of remote rights.

Runtime work follows the existing red/green, fresh independent review and milestone acceptance
process. This planning update authorizes no release, production cutover or live-service changes.
