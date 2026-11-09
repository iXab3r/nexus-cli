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
