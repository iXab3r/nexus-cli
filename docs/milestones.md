# Approved delivery milestones

Authority: [owner approval](https://github.com/iXab3r/nexus-cli/issues/1#issuecomment-6690348756).

| Milestone | Stories | Outcome |
|---|---|---|
| M1 Connect and inspect | S01–S07 | Isolated profiles, honest access evidence, repository inspection |
| M2 Find and retrieve | S08–S16 | Bounded enumeration and safe explicit downloads |
| M3 Publish and remove deliberately | S17–S21 | Raw/Maven publication and exact deletion |
| M4 Bounded hosted operations | S22–S23 | Raw hosted inspection/create |

S24 remains deferred and belongs to no approved implementation milestone.
The 442 operations and 120 groups are a coverage census, not an implementation promise.

Every milestone requires committed red acceptance evidence before implementation, green offline real-command-tree tests, package install smoke and fresh independent review at the final head. Parent owns PRs, acceptance and closure. Stories and operations stay open until their behavior is accepted at that head; dependency links do not prove implementation.

CliFactory is pinned exactly to 0.6.1. It includes the approved arbitrary-output publishFile extension; no framework edits belong here. No live compatibility, npm publication or TeamCity configuration is authorized by this plan.

## Delivery tracking

The runtime scaffold and generated API inventory are present. GitHub Issues owns
operation dependencies, milestone readiness, review findings and final acceptance;
this document records the approved grouping, not completion status.

## Owner-authorized expectations expansion

M5 [Reliable artifact roundtrip](https://github.com/iXab3r/nexus-cli/milestone/5):
S25–S28 (#608–#611), original Maven POM/assets, direct content, diagnostics and offline CI recipe.
M6 [Deliberate search and discovery](https://github.com/iXab3r/nexus-cli/milestone/6):
S29–S30 (#612–#613), including bounded prerequisite discovery as committed M6 scope.
Material designs require independent parent review before implementation. S24 stays deferred.
S31 token administration (#614), public distribution (#615) and live qualification (#616)
are conditional backlog outside these implementation commitments. Release and named service
target authorization remain separate. Existing API closure does not implement a new story.

## Approved standalone Nexus extension

[Owner approval](https://github.com/iXab3r/nexus-cli/issues/645#issuecomment-6725968859)
selects the following ordered extension of the Nexus 3.96.3-01 offline contract.
The complete acceptance and numerical forecast remain in
[#645](https://github.com/iXab3r/nexus-cli/issues/645#issuecomment-6725911727).

| Milestone | Outcome | Operation dimensions |
|---|---|---|
| [M7](https://github.com/iXab3r/nexus-cli/milestone/7) | [Q1 known-store quota status #649](https://github.com/iXab3r/nexus-cli/issues/649) | One new named GET |
| [M8](https://github.com/iXab3r/nexus-cli/milestone/8) | [Q2 exact metadata sizes #647](https://github.com/iXab3r/nexus-cli/issues/647) | Exact int64 values across six metadata routes; number in the safe range, decimal string outside it |
| [M9](https://github.com/iXab3r/nexus-cli/milestone/9) | [Q3 native search selectors #650](https://github.com/iXab3r/nexus-cli/issues/650) | All 80/80/79 query dimensions on existing search endpoints |

The selected pool contains eight identities. Full-contract promotion requires each
milestone's final acceptance; a declared route or an old closed issue is insufficient.
Keep the existing RED→GREEN and independent-review gates. This approval grants no
live access, npm publication or TeamCity mutation.
