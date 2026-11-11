# nexus-cli — agent router

A standalone, general-purpose CLI for Sonatype Nexus Repository REST API, built on
EyeAuras.CliFactory. This file is the entry point for coding agents. Durable product contracts
belong in `docs/`; scope, acceptance and delivery state belong in GitHub Issues.

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
- [Product README skill](https://github.com/iXab3r/EyeAuras.CliFactory/tree/main/.claude/skills/product-readme) for the README overview, coverage matrix and pictures; see [updating](docs/coverage-comparison.md#updating)

These framework laws apply here. Links are required reading, not copied local implementations.
Framework repository paths describe its ownership; this repository owns only the Nexus product.

## Story Delivery Lead — primary delivery role

For planning or delivering this product, adopt **Story Delivery Lead**. Read its canonical
[role](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/roles/story-delivery-lead.md) and
[story-driven delivery practice](https://github.com/iXab3r/EyeAuras.CliFactory/blob/c313194f8cd22547dae6ae8693a2771f3a5066f0/docs/practices/story-driven-delivery.md).
The role owns the delivery process, not production code. Compose it with the integration author,
GH issue dev, CLI writer and Reviewer as the work requires.

Current coordination: [Nexus CLI coverage #645](https://github.com/iXab3r/nexus-cli/issues/645).
[Planning issue #1](https://github.com/iXab3r/nexus-cli/issues/1) records the original approvals.
The product is independently defined by Nexus contracts and its selected stories. Contracts,
permissions or implementation plans of another server do not determine this CLI's scope.
Follow the canonical sequence:

1. Generate an API inventory from a pinned official Nexus specification. Record version, edition,
   provenance and logical operation identities. Obtain owner approval before publishing the inventory.
2. Prepare the bounded ordered Nexus story extension: actor/goal, concrete commands, observable
   output/error/exit behavior, Given/When/Then acceptance, permission categories and scope limits.
   The original 20–25-story bootstrap is not a quota for each extension.
   Obtain owner approval of the list and order.
3. Link stories to required API operation issues using GitHub **blocked by** relationships.
   Resolve missing or unknown API needs before milestone assignment.
4. Group stories into shippable milestones and obtain owner approval of the plan before production code.
5. Commit failing story acceptance tests on the story branch before implementation; implement to green.
   Red, skipped or expected-failure story tests never merge to main.
6. Run independent review at the completed milestone head. Record accepted findings as bugs in the
   same milestone, fix them and repeat with fresh reviewers. Close stories and covered operations
   only at the verified final milestone head; no accepted debt crosses a milestone without owner agreement.

Inventory measures coverage; stories determine implementation order. Inventory does not commit the
product to every Nexus feature. Use `type:api-group`, `type:api`, `type:story`, `type:review` and
`api:<group>` as prescribed during approved planning setup; milestone defects use `bug`.
S01–S23 and four milestones are approved in [the delivery plan](docs/milestones.md).
S24 is deferred. The [product contract](docs/product-contract.md), [stories](docs/stories.md)
and [source contracts](docs/source-contracts.md) define acceptance. Generate the offline census
with `python3 docs/api/generate_inventory.py`; inventory publication is authorized.
The 3.96.3-01 source baseline is not a live compatibility claim.

## Product rules

- **Universal Nexus product.** Model Nexus repositories, components, assets and REST semantics.
  No knowledge of specific deployments or alternative server implementations. All examples and
  fixtures are synthetic; real addresses, identities, credentials and responses stay out of Git.
- **Framework boundary.** CliFactory owns command declarations, help, rendering, JSON/JSON-RPC,
  profiles, secrets and permission gates. nexus-cli owns Nexus paths, DTOs, authentication protocol
  integration, pagination, transfers and service error semantics. Do not copy or fork framework code.
- **Framework changes.** Propose separately, with analysis of existing consumers and owner approval
  before creating framework issues or PRs outside the approved publishFile extension. Do not add speculative shared infrastructure here.
- **Standalone.** No IPC package, daemon or MCP server. One command tree serves every output mode.
- **Compatibility scope.** Choose supported Nexus versions and editions explicitly in planning;
  do not infer support from a latest OpenAPI snapshot or assume all editions expose every operation.
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
