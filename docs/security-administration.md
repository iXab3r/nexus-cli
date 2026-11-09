# Nexus security administration

Security commands use the selected profile's installation and authentication. Reads require
ReadOnly; mutations require Update. Nexus service permissions remain independent of these local
gates. A 401/403 or inaccessible capability observation is a failure, not evidence of disabled access.

```sh
nexus-cli security anonymous get --json
nexus-cli security anonymous set --input-file anonymous.json --json
nexus-cli security realms available --json
nexus-cli security realms active --json
nexus-cli security realms set-active --input-file realms.json --json
nexus-cli security default-role get --json
nexus-cli security default-role set --input-file default-role.json --json
```

Anonymous input is `{ "enabled": false, "userId": "anonymous", "realmName": "NexusAuthorizingRealm" }`.
Realms input is an ordered array of realm IDs. Preserve required existing realms when adding native
format realms. Default Role input is `{ "enabled": true, "role": "approved-role" }`. Its observation
includes state (`active`, `configured`, `disabled`, `absent`, `unsupported`), configured role, capability
identity, enabled/effective active flags and realm activation. The command composes actual capabilities
list/types and active realms. Multiple defaultrole records fail as ambiguous. The setter changes only
the selected Default Role capability; activation/passivation can change the DefaultRole realm on Nexus.
Anonymous role assignment is independent of this authenticated default role.

Users, roles, privileges and content selectors expose list/get/create/update/delete as applicable:

```sh
nexus-cli security users list --user-id synthetic-reader --json
nexus-cli security roles get synthetic-role --json
nexus-cli security privileges get synthetic-privilege --json
nexus-cli security content-selectors get synthetic-selector --json
nexus-cli security roles create --input-file role.json --json
nexus-cli security roles update synthetic-role --input-file role.json --json
nexus-cli security roles delete synthetic-role --confirm-id synthetic-role --json
```

Users have list (with optional userId search), create, update, change-password and delete. Roles,
privileges and content selectors have list/get/delete. Role and selector mutations use their native
Nexus request DTOs. Privilege create/update is restricted to repository-view and
repository-content-selector branches. Reads include complete supported privilege definitions:
application domain, wildcard pattern, repository format/name/actions, selector and script fields.
The CLI does not infer effective authority from privilege IDs or synthesize effective grant booleans.
Roles retain inherited role IDs and privilege IDs; users retain local/external role assignments.

All service JSON files contain at most 65,536 UTF-8 bytes. Unknown fields fail before mutation.
User create input contains its initial password and requires a POSIX owner-only regular file.
For `security users change-password <id> --credentials-file <json>`, the protected file has exactly
`{ "password": "<new password>" }`; the native API receives text/plain. Other create/update inputs
use `--input-file`. Selectors create accepts name/description/expression; Nexus supplies `type` on
reads. Selector update accepts description/expression. Preserve unrelated inherited grants and shared
roles when preparing replacements. Deletion requires an exact matching --confirm-id.

Updates replace supplied settings, are not atomic with earlier observations and never retry. A failed
transport may leave a mutation committed. Record owned identities before uncertain creates, establish
absence first, and retain exact cleanup/recovery records until the outcome is independently known.
Service commands do not consume stdin; Core's profile/auth credential stdin remains unchanged.

## Mutation acknowledgments on Nexus 3.97.0-13

The active-realms PUT and existing Default Role capability PUT acknowledge HTTP **204**.
Anonymous PUT and new Default Role capability POST acknowledge HTTP **200**. The CLI
requires the exact operation status; an unexpected 2xx fails with
`nexus.mutation.acknowledgementUnknown`, stating that remote changes may have occurred
and state must be reconciled before retrying. It does not retry or report that response
as a refusal. A subsequent read can establish the current settings without replaying the write.

This overrides misleading generated Swagger defaults using the official resource return contracts:
[RealmApiResource.setActiveRealms](https://github.com/sonatype/nexus-public/blob/76b8303954ef1296507631aaabb69f980069a163/public/selfhosted/components/api/nexus-api-rest-selfhosted/src/main/java/org/sonatype/nexus/api/rest/selfhosted/security/realm/RealmApiResource.java)
returns void after setting the ordered IDs;
[AnonymousAccessApiResource.update](https://github.com/sonatype/nexus-public/blob/76b8303954ef1296507631aaabb69f980069a163/public/selfhosted/components/api/nexus-api-rest-selfhosted/src/main/java/org/sonatype/nexus/api/rest/selfhosted/security/anonymous/AnonymousAccessApiResource.java)
returns a settings DTO. Under the [Jakarta REST return-type contract](https://jakarta.ee/specifications/restful-ws/3.1/jakarta-restful-ws-spec-3.1.html#resource_method_return_type),
synchronous void returns no content/204; a non-null DTO returns 200.

The same official 3.97.0-13 image pinned in [the key protocol](nuget-key-protocol.md)
contains `nexus-api-rest-selfhosted-3.97.0-13.jar`
(SHA256 `5b68866a4c345b337be0c40a324d365503bc719e77ad390ac7260c83c05ace7d`)
and `nexus-api-rest-selfhosted-private-3.97.0-13.jar`
(SHA256 `859617b568d9e98aa074ae23604a3707b5f45f285c61483014d98b02ff722d05`).
Their bytecode confirms the realms/anonymous return types and proprietary
`CapabilityResource.update(String, CapabilityDTO): void` versus
`CapabilityResource.create(CapabilityDTO): CapabilityDTO`.

Sibling status audit: user and role creates return DTO/200; user/role updates,
password replacement, selector create/update and security deletes return void/204.
Repository privilege creates explicitly return 201, updates return void/204.
Those existing statuses remain unchanged. Offline command-tree regressions exercise
expected statuses, unexpected 200/201/202/204 and 401/403 across human, JSON and RPC,
including exactly one mutation per invocation. This source contract does not record
a new production status observation.
