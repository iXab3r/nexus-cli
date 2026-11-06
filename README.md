# nexus-cli

Standalone Nexus Repository CLI built on `@eyeauras/cli-factory` **0.5.5**.

M1 provides profile configuration, Basic or explicit anonymous access, local
credential status/logout, service availability, and repository list/detail.
M2 slice S08–S14 provides components/assets list/get and search components/assets.
Transfers and mutations remain unimplemented; M2 is not complete. Tests use the pinned 3.96.3-01 specification and synthetic
responses; no live Nexus version or edition compatibility is claimed.

```sh
printf '%s' '{"username":"synthetic-reader","password":"synthetic-password"}' | nexus-cli profile configure lab --url https://nexus.example.test:443/context --credentials-stdin
nexus-cli profile configure public --url https://nexus.example.test --auth-mode anonymous
nexus-cli auth status --profile lab
nexus-cli status --profile lab
nexus-cli repositories list --profile lab --json
nexus-cli repositories get releases --profile lab
nexus-cli auth logout --profile lab
```

The credential pair is stored through Core's profile-scoped secret store, not in
profile JSON. Password bytes are preserved. Missing or malformed pairs fail;
401 probes preserve prior state. A 403 probe admits locally valid credentials
because a narrower repository request may still work. No Basic failure retries
anonymously. Logout removes local credentials only.

Core's configure result uses `authenticated: true` as persistence admission,
not identity proof. Nexus details under `identity` report `storedUnverified` or
`anonymousConfigured`, preserved URL and probe outcome. Explicit auth status
reports `authenticated: false`, local `ready`, state and independent probe outcome
(`notRun`, `accessObserved`, `denied`, `rejected`, `unavailable`). HTTP success
never proves identity. Anonymous logout leaves the explicit anonymous mode enabled.
Core supplies the profile/auth human renderer and JSON/RPC envelopes; stdin
credentials require ordinary CLI execution, not RPC. No credential environment
variable or password command-line flag is supported.

Service leaves use the profile's ReadOnly gate. Repository lists show only server
visibility, including an empty success; they are not full installation inventories.
Summary fields are name, format, type, URL and online (`null` when the server omits
online). A single response is limited to 4 MiB and lists to 1,000 entries.
Repository names are encoded as one path segment. Availability uses both
`/service/rest/v1/status` and `/service/rest/v1/status/writable`; failure including
503 exits 1 and never proves authentication. All service errors use stderr in
ordinary CLI execution and RPC error envelopes, with no response body dump.

## Development

Use Node.js 22.13 or newer and npm 10 or newer for development.
The packaged CLI supports Node.js 22 or newer.

```sh
npm ci
npm test
npm run build
npm run test:package
node dist/src/bin.js --help
```

Dependency installation requires npm registry access (or a populated cache).
After setup, `npm test` runs offline with MSW at native fetch, temporary AppData
and an in-memory secret store supplied by the factory fixture. Unhandled HTTP
requests fail. Extend `tests/offline.ts` with story-owned MSW handlers and test
the real command tree; do not replace fetch with a mock implementation.

The separate package smoke packs an archive, verifies its exact file allowlist,
installs into a disposable npm prefix, and runs the actual executable's help, version, anonymous configure and profile inspection with network connections blocked and isolated user directories.
Its dependency-install phase may access npm; command execution is offline.
Temporary installation files are removed afterward. The archive includes only
runtime JavaScript, package metadata and this README.

This package is private while under development. No publish, CI service,
daemon, MCP server or live Nexus testing is configured.

Credential JSON read from stdin is limited to 64 KiB (UTF-8 bytes). Cancellation
while waiting for input stops before HTTP or credential persistence.

## Read and search

```sh
nexus-cli components list --repository releases
nexus-cli components get COMPONENT_ID
nexus-cli assets list --repository releases --all --max-pages 10
nexus-cli assets get ASSET_ID
nexus-cli search components --repository releases --name widget --version 1.0
nexus-cli search assets --maven-extension jar --maven-classifier ""
```

Search accepts repository, name, version, group, format and q; asset search also
accepts Maven extension and classifier. Empty classifier is preserved. Matching
and ordering belong to Nexus. IDs and continuation tokens remain opaque.
Metadata download URLs omit userinfo, query and fragment to protect credentials.

Enumeration returns items, pagesFetched, complete, continuationToken, resume and
reason. Default execution reads one page, even an empty page with a next token.
Use --all for enumeration and --continuation-token TOKEN to resume. Defaults are
100 pages with --all, 4 MiB decoded bytes/page, 1,000 items/page, 10,000 total items
and 16 MiB serialized result. --max-pages, --max-page-bytes, --max-page-items,
--max-items and --max-result-bytes accept positive reductions only.
A failed or oversized page is rejected whole. Partial results exit 1, with
resume identifying the first undelivered page; restart=true means start without
a token. Repeated tokens fail with resume=null. Ordinary JSON puts partial data
on stdout and diagnostics on stderr; RPC puts it in error.data.result.
There is no snapshot or duplicate-free guarantee across server mutations.
Narrow server filters when a single page exceeds a limit.

S15/S16 downloads await the separately approved Core publishFile extension and
reviewed adoption. This slice adds no alternate file destination behavior.
The installed-package smoke additionally executes an assets read against a
synthetic fetch response with socket networking disabled. This is offline
packaging proof, not live Nexus compatibility evidence.
