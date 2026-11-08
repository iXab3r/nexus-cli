# nexus-cli — agent router

The CLI for EyeAuras.Depot package hosting, built on EyeAuras.CliFactory and a bounded
Nexus-compatible API. Depot is the product target; full Sonatype Nexus parity is not the goal.
This file is the agent entry point. Read [Depot compatibility](docs/depot-compatibility.md)
before selecting work. Durable contracts belong in `docs/`; delivery state lives in GitHub Issues.

## Framework baseline

Adopt CliFactory **v0.6.1**, commit `c313194f8cd22547dae6ae8693a2771f3a5066f0`, as the
runtime and instruction baseline. The published dependency is pinned exactly; keep these
instruction links aligned with it.
Read the relevant pinned contracts before changing their surfaces:

- [Universal laws](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/AGENTS.md)
- [Runtime and public API](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/DESIGN.md)
- [Integration authoring](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/integrations.md)
- [Offline tests and sanitization](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/testing.md)
- [CLI writer](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/roles/cli-writer.md) for every terminal-facing text

These framework laws apply here. Links are required reading, not copied local implementations.
Framework repository paths describe its ownership; this repository owns the Depot-facing CLI, not Depot server internals.

## Story Delivery Lead — primary delivery role

For planning or delivering this product, adopt **Story Delivery Lead**. Read its canonical
[role](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/roles/story-delivery-lead.md) and
[story-driven delivery practice](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/practices/story-driven-delivery.md).
The role owns the delivery process, not production code. Compose it with the integration author,
GH issue dev, CLI writer and Reviewer as the work requires.

Current coordination: [Depot #210](https://github.com/iXab3r/EyeAuras.Depot/issues/210).
[Issue #1](https://github.com/iXab3r/nexus-cli/issues/1) and S01–S30 record the historical
Nexus delivery baseline; they do not approve full parity or prove Depot compatibility.
Follow the canonical sequence:

1. Generate an API inventory from a pinned official Nexus specification. Record version, edition,
   provenance and logical operation identities. Obtain owner approval before publishing the inventory.
2. Prepare the bounded ordered story extension needed for Depot: actor/goal, proposed commands,
   observable output/error/exit behavior, Given/When/Then, permissions and explicit scope limits.
   The initial 20–25-story bootstrap is historical, not a quota for each extension.
   Obtain owner approval of the list and order.
3. Link stories to required API operation issues using GitHub **blocked by** relationships.
   Resolve missing or unknown API needs before milestone assignment.
4. Group stories into shippable milestones and obtain owner approval of the plan before production code.
5. Commit failing story acceptance tests on the story branch before implementation; implement to green.
   Red, skipped or expected-failure story tests never merge to main.
6. Run independent review at the completed milestone head. Record accepted findings as bugs in the
   same milestone, fix them and repeat with fresh reviewers. Close stories and covered operations
   only at the verified final milestone head; no accepted debt crosses a milestone without owner agreement.

Inventory preserves the pinned source census; owner dispositions and Depot stories determine work.
A `depot:candidate` operation is a contract reference, never implementation-ready by itself.
Read [depot-scope.json](docs/api/depot-scope.json); excluded/deferred/outside-scope issues are
NOT_PLANNED under this scope. Regeneration/publishing must preserve these dispositions, labels,
state reasons and native relationships, without reopening or turning exclusions into completed coverage.
Only an explicitly selected story with resolved API dependencies and an approved milestone may enter
implementation. Use `type:api-group`, `type:api`, `type:story`, `type:review` and `api:<group>`
as prescribed during approved planning setup; milestone defects use `bug`.
Historical S01–S23 and their four milestones are recorded in [the delivery plan](docs/milestones.md).
Historical S24 is outside the current Depot plan; S31 is superseded by the Depot direction.
The [product contract](docs/product-contract.md), [stories](docs/stories.md) and
[source contracts](docs/source-contracts.md) define acceptance. Generate the offline census
with `python3 docs/api/generate_inventory.py`; inventory publication is authorized.
The 3.96.3-01 source baseline is not a live compatibility claim.

## Product rules

- **Depot package-hosting product.** Support selected Depot stories through explicitly agreed
  Nexus-compatible contracts. Preserve immutable versions/manifests, durability and current independent
  Read/Write/Delete. Full Nexus parity, extra formats/providers/backends and administrative machinery
  require a new explicit scope decision; shared names do not prove equivalent semantics. All examples
  and fixtures stay synthetic; real endpoints, identities, credentials and responses stay out of Git.
- **Historical compatibility evidence.** v0.1.0 and existing commands/tests form a Nexus baseline.
  Preserve delivered functionality until a reviewed replacement migrates consumers; do not claim
  Depot support, delete legacy commands or add fallback behavior from this planning update alone.
- **Framework boundary.** CliFactory owns command declarations, help, rendering, JSON/JSON-RPC,
  profiles, secrets and permission gates. nexus-cli owns agreed Depot/Nexus-compatible paths, DTOs,
  authentication protocol integration, pagination, transfers and service error semantics. Do not copy or fork framework code.
- **Framework changes.** Propose separately, with analysis of existing consumers and owner approval
  before creating framework issues or PRs outside the approved publishFile extension. Do not add speculative shared infrastructure here.
- **Standalone.** No IPC package, daemon or MCP server. One command tree serves every output mode.
- **Compatibility scope.** Declare the exact Depot revision and selected API contracts for each story.
  The Nexus pin supplies reference shapes and historical evidence, not Depot feature entitlement.
  Any retained Nexus support claim still needs explicit version/edition evidence; never infer support
  from latest OpenAPI or assume every operation exists.
- **Tests.** Default tests are offline MSW mocks at native fetch, exercising the real command tree.
  No live service or container tests in CI. Real-service proof requires separate authorization and
  follows the framework's bounded local packaged-CLI practice. Sanitize fixtures before committing.
- **Build/release direction.** Follow the CliFactory/opensearch-cli TeamCity main-only approach,
  Cake Frosting and `build/teamcity.sh`. No GitHub Actions or PowerShell infrastructure. These are
  implemented locally; [release setup](docs/release.md) records the root-owned TeamCity cutover
  and staged publication. Source preparation does not claim deployed CI or a published package.
- **Privacy.** Before every commit inspect the full tracked tree and staged diff for secrets,
  private endpoints, personal data and unsanitized responses. Resolve findings before commit/push.

## Supporting roles and delivery rules

- [GH issue dev](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/roles/gh-issue-dev.md) and
  [issue lifecycle](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/practices/github-issues.md) govern issue/PR work.
- [Reviewer](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/roles/reviewer.md) and
  [independent review](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/practices/independent-review.md) govern completed-diff reviews.
- [Reconciliation Lead](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/roles/reconciliation-lead.md) and
  [workstreams](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/practices/workstreams.md) govern bounded inventory audits.
- GitHub Issues is the tracker. Partial PRs reference issues without closing keywords.
- New branches default to `bugfix/`, unless explicitly named by the owner. Never force-push or
  rewrite pushed history.
- Keep transient notes in Git-ignored `.workspace/workstreams/<id>/` under the verified task root.
- npm staging/publication, TeamCity configuration changes and real-service access each require
  explicit owner authorization; planning or installing these instructions does not grant it.
- Before a test harness exists, documentation-only setup uses link, diff and privacy inspection.
  Once bootstrapped, follow the framework's required verification; never claim unrun tests passed.
