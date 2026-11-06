# Nexus CLI product contract

[Owner approval](https://github.com/iXab3r/nexus-cli/issues/1#issuecomment-6690348756) authorizes S01–S23 across four milestones. S24 is deferred. npm publication, TeamCity changes and live Nexus access remain excluded.

## Reproducible specification provenance

Official documentation https://help.sonatype.com/en/api-reference.html links https://sonatype.github.io/sonatype-documentation/api/nexus-repository/latest/nexus-repository-api.json . Independently fetched that public documentation artifact; bytes equal the parent's preliminary file. Saved as nexus-openapi.json, OpenAPI 3.0.1, info.version 3.96.3-01, SHA-256 `2d5261f26dd225103e886c0cb2becfa710b690a19e308a504cdd57a9293407ca`. Retrieval 2026-11-06. The URL is mutable: the local content hash, not “latest”, pins this research. Upstream repository commit behind the published document was not established. No deployed instance supplied this evidence.

Run `python3 docs/api/generate_inventory.py` from repository root. Python standard library only, offline, hash assertion, deterministic ordering; writes inventory.json and inventory.md beside script. Counts: **442 disambiguated operation identities (439 original operationId strings), 442 HTTP method/path pairs, 297 path entries**. Repeated IDs are distinct method/path identities; different IDs are deliberately not merged on guessed equivalence. All method/path aliases, tags, summaries and response codes retained. Primary sorted tag supplies additive group counts. Inventory is a coverage census, never a parity promise; Publication is authorized by the approval linked below.

## Approved product scope

Initial scope is a standalone CLI for self-hosted Nexus 3, Basic username/password via custom AuthDefinition and explicit anonymous mode, raw/Maven REST publication, bounded discovery/download and raw hosted inspection/create. Keep CliFactory v0.5.5 pinned. Source 3.96.3-01 is the reproducible offline fixture baseline, NOT a recommendation to install that patch. Recommend a currently maintained self-hosted Community release for separately authorized compatibility proof; exact deployment patch is an owner selection with API delta review before claiming support. Pro/token-pair entitlement and Cloud remain outside the first support claim.

Installation URL preserves explicit port/context prefix before /service/rest. Pagination tokens are opaque; no snapshot consistency or total count inferred. Search/download uses server ordering and match semantics, preserving explicit empty classifier filters. No automatic mutation retries; transport loss after send is nexus.mutation.outcomeUnknown.

The completed source conclusions, exact call sites, limitations and additive framework proposal are in [source-contracts.md](source-contracts.md). S15/S16 retain arbitrary --output; the existing profile-file API cannot safely supply that UX. Use the separately approved narrow Core extension described there when delivered, with existing callers unchanged. The additive framework extension is separately approved and outside this repository’s implementation scope. Hosted GET has a concrete raw adapter; hosted PUT supports disposition but not proxy forwarding controls. S24 is deferred. REST generated POM does not repeat the submitted asset's selector check; acceptance must describe this accurately.

## Shared acceptance contract

## 4 — transfer acceptance

For initial asset.downloadUrl AND every redirect, reject userinfo and schemes other than HTTPS (explicit HTTP installation opt-in may allow same-origin HTTP only). Reject every HTTPS-to-HTTP downgrade. Attach Basic to the configured installation origin and retain the pinned Core same-host HTTP-to-HTTPS upgrade exception, including non-default ports. Apply this eligibility check to the initial returned URL as well as redirects; other cross-origin HTTPS content is fetched anonymously. Never propagate credentials to origins outside that eligibility rule. Test initial same-host HTTPS upgrade, redirected same-host HTTPS upgrade (including non-default ports), first-hop unrelated origin and same-origin->cross-origin->same-origin chain; credentials once stripped stay stripped. Core fetchWithRedirects accepts an injected fetch: wrap that transport to validate each target before network access; do not duplicate its redirect loop. Default loop limit is Core's 20.

Accept final 200 only: reject 206, missing body, HTTP failures, aborted/truncated streams and mismatched known length. Compression means wire Content-Length cannot be compared blindly with decoded bytes. Validate supplied SHA256 before publication; unsupported digest is usage failure, missing digest means verified=false. Approved download cap 1 GiB with explicit positive --max-bytes override. Reuse Core exclusive link and identity validation; existing file, symlink and racing creator must fail without overwrite. No unconditional cleanup claim: expose published/cleanupFailed in the CliError result, preserve cause, exit 1 even if publication succeeded but cleanup failed. Never remove a destination that may belong to another process. These guarantees are acceptance requirements for the proposed Core destination extension.


## 5 — bounded enumeration and result contract

Approved fixed defaults, reducible by flags: 4 MiB decoded response bytes per page; 1,000 items per page; 10,000 accumulated items; 16 MiB UTF-8 serialized domain result; 100 pages for --all, one otherwise. Reject unreasonable/increasing overrides initially; larger jobs use continuation tokens. readResponseBody caller maxBytes enforces body limit before decoding; item/output budgets are checked on a complete decoded page before accepting it. No generic streaming system. Human views project bounded fields; JSON/RPC serialize the same bounded result (envelope overhead additional, capped diagnostic text). A giant page fails even on its own; user needs narrower server filters, not endless resume retries.

A null resume means no safe automatic continuation. Domain shape: {items, pagesFetched, complete, continuationToken, resume:({restart:boolean,token:string|null}|null), reason:null|string}. On failure use new CliError(message,{code,exitCode:1,result:domain,cause}); actual pinned CliErrorOptions.result and stream-result.ts preserve error.result. Do not attach arbitrary fields to MachineError and expect serialization. Approved codes: nexus.pagination.pageBudget, byteBudget, itemBudget, repeatedToken, fetchFailed, decodeFailed; nexus.mutation.outcomeUnknown. Ordinary JSON partial result is stdout domain JSON; stderr contains the Core error envelope, exit 1. Human stdout renders the result and stderr diagnostics. RPC carries the result in error.data.result. See source-contracts.md for source paths.

Resume is the input token of the first UNDELIVERED page, never that page's output token. On oversized/decode/HTTP/stream failure reject the whole page, retain prior accepted pages, and return that input token. If first page failed, resume.restart=true and token=null. At page cap resume is last accepted page's next token. Repeated-token result has resume=null (unsafe to progress). If output cannot be delivered, do not claim checkpoint delivery; caller restarts from its last successfully received result. No snapshot/no-duplicates guarantee across server mutations. Default single-page result can succeed with complete=false and next token; requested --all exhaustion exits 1.


## Acceptance clarifications

Authentication S01/S03: malformed pair fails before persistence; reject empty username, colon in username/control characters, malformed JSON; preserve password bytes. A server 401 on an explicit probe is rejected credentials evidence for that request and configure must preserve prior state. A 403 is denied probe, not invalid credentials. Local structurally valid stored pair can be unverified and usable for narrow commands. Readiness is only local presence/mode, never repository-list access. States: absent, anonymousConfigured, storedUnverified; separate probe outcome notRun/accessObserved/denied/rejected/unavailable. Public success only proves accessObserved, never identity. No silent Basic-to-anonymous fallback. Custom login returns Core's persistence admission after local pair validation, with public details explicitly unverified; optional probe denial cannot invalidate that admission. Secure-store failure remains failure; later explicit status never deletes credentials.

Destruction S20/S21: Update gate and exact opaque --confirm-id equality apply identically to CLI/RPC before service reads/mutations. Preflight getAssets/getComponents is required to show the exact object; denied, unavailable or absent preflight stops with zero DELETE, even if delete permission might independently exist. No bypass or retry on unknown outcome. Escape IDs as single path segments. Count is observed preflight only.

S17 removes listFormatsUploadSpecs: demonstrated get uses only getFormatsUploadSpecs. S23 removes listBlobstores: supplied existing name is validated by create on server, avoiding extra admin privilege. Only actually exercised operation dependencies can close.



## Source privacy inspection

Resolved synthetic placeholder: official schema JSON pointer `/components/schemas/TerraformSigningAttributes/properties/keypair/example` contains PGP boundary labels with only `...` between them, not key material. Source bytes and SHA-256 remain unchanged. No deployed responses or credentials are fixtures.
