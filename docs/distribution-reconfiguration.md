# Reconfigure a distribution installation through the CLI

Use one selected local artifact and a separately authorized administration profile. The observer
profile retains its own ReadOnly gates. The commands below describe provisioning; running them
against a real installation requires the corresponding owner-approved scope and credentials.
Publication/download remain with cargo, dotnet, npm and docker.

## Establish independent inputs

Record repository names, blob store, upstream URLs, ordered groups, users/roles/grants and expected
anonymous/default-role policy independently of the actual response. Preserve the existing NuGet
protocol/query-cache/HTTP-client settings unless the approved change replaces them. Start with:

```sh
nexus-cli permissions list --profile administration --json
nexus-cli blobstores list --profile administration --json
nexus-cli repositories list --profile administration --json
nexus-cli security anonymous get --profile administration --json
nexus-cli security realms available --profile administration --json
nexus-cli security realms active --profile administration --json
nexus-cli security default-role get --profile administration --json
nexus-cli security roles list --profile administration --json
nexus-cli security privileges list --profile administration --json
```

A refusal, partial result, malformed response or unsupported required capability stops that proof.
Default Role observations distinguish absent/disabled/configured/active/unsupported; unsupported
is not a disabled-policy baseline. Privilege IDs are resolved through their complete definitions.

## Prepare the 28 repository inputs locally

The following Node example writes synthetic JSON inputs and a manifest without contacting Nexus.
Replace its names/upstreams/storage with the approved inputs before applying them. It creates twelve
hosted inputs, four proxies and twelve groups. Groups use direct hosted members in exact precedence;
no writableMember is set. Proxy access is on demand, not eager mirroring.

```sh
node --input-type=module - <<'JS'
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('distribution-plan');
await mkdir(directory, { mode: 0o700 }); // existing plan is not overwritten
const storage = { blobStoreName: 'default', strictContentTypeValidation: true };
const scopes = ['public', 'shared', 'internal'];
const manifest = [];
for (const format of ['cargo', 'nuget', 'npm', 'docker']) {
  const docker = format === 'docker'
    ? { docker: { v1Enabled: false, forceBasicAuth: true, pathEnabled: true } } : {};
  const definitions = scopes.map(scope => ({ type: 'hosted', value: {
    name: `${format}-${scope}-hosted`, online: true,
    storage: { ...storage, writePolicy: 'ALLOW_ONCE' }, ...docker,
  } }));
  const proxyName = `${format}-proxy`;
  definitions.push({ type: 'proxy', value: {
    name: proxyName, online: true, storage,
    proxy: { remoteUrl: `https://${format}-upstream.example.test/index`,
      contentMaxAge: 1440, metadataMaxAge: 1440, preserveEncodedCharacters: false },
    negativeCache: { enabled: true, timeToLive: 1440 },
    httpClient: { blocked: false, autoBlock: true }, ...docker,
    ...(format === 'cargo' ? { cargo: { requireAuthentication: false } } : {}),
    ...(format === 'nuget' ? { nugetProxy: { nugetVersion: 'V3', queryCacheItemMaxAge: 3600 } } : {}),
    ...(format === 'docker' ? { dockerProxy: { indexType: 'HUB', cacheForeignLayers: false } } : {}),
  } });
  for (let i = 0; i < scopes.length; i++) definitions.push({ type: 'group', value: {
    name: `${format}-${scopes[i]}-group`, online: true, storage, ...docker,
    group: { memberNames: [...scopes.slice(0, i + 1).reverse()
      .map(scope => `${format}-${scope}-hosted`), proxyName] },
    ...(format === 'cargo' ? { cargo: { requireAuthentication: i > 0 } } : {}),
  } });
  for (const { type, value } of definitions) {
    const inputFile = resolve(directory, value.name + '.json');
    await writeFile(inputFile, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
    manifest.push({ format, type, name: value.name, inputFile });
  }
}
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2),
  { mode: 0o600, flag: 'wx' });
console.log(`Prepared ${manifest.length} repository inputs`);
JS
```

The synthetic URLs are placeholders, not working upstreams. NuGet V3 requires the actual v3 service
index. Configure Docker Hub/custom index and connectors/path routing for the selected installation;
forceBasicAuth alone does not establish anonymous policy. Cargo hosted has no cargo authentication
override. Public Cargo/NuGet/npm access follows anonymous roles and repository grants; Docker remains
authenticated at each level. Shared/internal access needs the independently approved roles.

## Apply confirmed creates or prepared replacements

For each manifest entry, first inspect the exact typed repository:

```sh
nexus-cli repositories proxy nuget get nuget-proxy --profile administration --json
nexus-cli repositories proxy nuget create --input-file distribution-plan/nuget-proxy.json --profile administration --json
nexus-cli repositories proxy nuget update nuget-proxy --input-file distribution-plan/nuget-proxy.json --profile administration --json
```

Use create only after confirmed absence in the intended typed route. For an existing repository,
prepare a full replacement retaining all supported settings outside the approved changes. Remove
response-only format/type/url; NuGet proxy also removes response-only storage.writePolicy. Do not
send a general repository summary as a typed update. Group arrays replace membership in order;
shared never gains an internal member. A GET/PUT pair is not atomic. Do not retry an uncertain write;
retain the exact identity and reconcile its observation first.

The manifest order permits hosted → proxy → groups for each format. Read every repository back and
compare the approved fields/order after create/update. The offline real-command replay covers all
28 creates/observations/replacements, including unrelated NuGet query-cache/connection fields.

## Configure identities and narrow grants

[Security administration](security-administration.md) defines each request shape. A role input keeps
its direct privilege IDs and inherited role IDs. Repository-view privilege input contains
name/description/actions/format/repository. Selector creation contains name/description/expression;
Nexus supplies its type on reads. A repository-content-selector privilege additionally names
contentSelector. Build the selected package expression from an independently approved format-specific
selector contract, including native metadata paths.

```sh
nexus-cli security content-selectors create --input-file selector.json --profile administration --json
nexus-cli security privileges repository-content-selector create --input-file selected-read.json --profile administration --json
nexus-cli security roles create --input-file reader-role.json --profile administration --json
nexus-cli security users create --input-file reader-user.json --profile administration --json
```

Record owned identities before uncertain creates and verify them absent first. User creation input
contains a password and requires a protected owner-only file. Preserve unrelated/shared and separately
granted internal roles when replacing a user/role. Apply the approved anonymous identity separately
from authenticated Default Role. Replace active realms with the full preserved order plus the required
available native realms; do not substitute a guessed realm ID. Read anonymous/realms/default-role and
the complete user/role/privilege graph back before treating access as configured.

For NuGet, [self-service key handoff](nuget-key-protocol.md) uses the exact supplied owned principal,
protected credentials-file and explicit protected output. Revoke the previous key before deleting an
owned user. Cleanup uses exact IDs with matching --confirm-id, in dependency order: user, role,
privilege, selector. Shared records are not adopted as owned cleanup targets.

## Verify outcomes without weakening the oracle

Native client success/denial remains the package access oracle. Existing non-indexed component/asset
browse can support a bounded exhaustive catalog through an independently verified broad READ/BROWSE
metadata principal, with complete=true, null continuationToken and null reason, plus a known positive
control. Permission-filtered, partial, denied or budget-limited catalogs do not prove absence. Indexed
search alone does not settle a native 401/403. Compound writes and in-flight activity require the
consumer's separate exact-state/quiescence/recovery contract before a negative write can be accepted.
