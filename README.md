# nexus-cli

Standalone npm CLI scaffold for Sonatype Nexus Repository, built on
`@eyeauras/cli-factory` 0.5.5.

Only `nexus-cli --help` and `nexus-cli --version` are verified here.
Nexus profiles, authentication and repository commands are not implemented.
Factory-provided options are framework capabilities, not completed Nexus stories.
M1 story acceptance tests must be committed red on their story branches before
implementation. No Nexus version or edition compatibility is claimed.

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
installs into a disposable npm prefix, and runs the actual executable's help and
version with network connections blocked and isolated user directories.
Its dependency-install phase may access npm; command execution is offline.
Temporary installation files are removed afterward. The archive includes only
runtime JavaScript, package metadata and this README.

This package is private while under development. No publish, CI service,
daemon, MCP server or live Nexus testing is configured.
