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

CliFactory is pinned exactly to 0.6.0. It includes the approved arbitrary-output publishFile extension; no framework edits belong here. No live compatibility, npm publication or TeamCity configuration is authorized by this plan.

## Delivery tracking

The runtime scaffold and generated API inventory are present. GitHub Issues owns
operation dependencies, milestone readiness, review findings and final acceptance;
this document records the approved grouping, not completion status.
