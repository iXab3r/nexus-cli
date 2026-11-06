# nexus-cli

Standalone Nexus Repository CLI built on `@eyeauras/cli-factory` **0.5.5**.

M1 provides profile configuration, Basic or explicit anonymous access, local
credential status/logout, service availability, and repository list/detail.
Later milestone commands (components, assets, search, transfers and mutations)
are not implemented. Tests use the pinned 3.96.3-01 specification and synthetic
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
