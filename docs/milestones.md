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

CliFactory is pinned exactly to 0.5.5. The separately approved arbitrary-output extension is an M2 prerequisite; no framework edits belong here. No live compatibility, npm publication or TeamCity configuration is authorized by this plan.

## Tracker checkpoint

This bounded planning slice publishes 23 stories and four milestones only. The 442 operation issues and 120 group roots, and real GitHub blocked-by links, remain pending the next inventory phase. Milestone assignment records the approved grouping, not implementation readiness. Planning closure and production execution remain gated on that inventory/dependency phase. GitHub owns ongoing story acceptance and status; documents own durable product behavior. No runtime scaffold exists.
