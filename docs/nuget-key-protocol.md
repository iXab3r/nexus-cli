# Self-service NuGet keys

```sh
nexus-cli security nuget-api-key export --user-id synthetic-publisher --credentials-file credentials.json --output publication-key.json --json
nexus-cli security nuget-api-key revoke --user-id synthetic-publisher --credentials-file credentials.json --json
```

Both commands require Update, including export: acquiring a key may create it. The credential file
contains exactly `{ "username": "synthetic-publisher", "password": "<password>" }`, UTF-8 JSON up to
65,536 bytes. The username must equal --user-id. The input must be a current-user-owned regular file
with no group/other access and no symlink. POSIX file protection is qualified; Windows protected-file
input currently fails explicitly until an equivalent owner ACL contract is implemented.

The selected profile supplies the installation URL. These commands use the supplied principal's Basic
credentials throughout, not the observer profile's stored secret. Credentials, tickets and keys are
invocation-local; no profile/secret-store update or browser session reuse occurs. Service stdin is not
supported. Core profile/auth stdin is unchanged.

Export exclusively publishes an owner-only file containing `{ "userId": "synthetic-publisher", "apiKey": "<key>" }`.
It returns only userId/output/exported metadata. An existing output fails before key acquisition. A
concurrent publication conflict also fails without overwriting; the remote key may already exist.
Revoke invalidates the previous key and returns only `{ "userId": "synthetic-publisher", "oldKeyRevoked": true,
"replacementCreated": true }`. Nexus immediately creates a replacement, which the CLI discards. Revoke
therefore does not mean that no key exists. Revoke before deleting an owned fixture user.

The protocol is version-sensitive and qualified by static inspection for Nexus 3.97.0-13 Community:

- Official Sonatype image `sonatype/nexus3:3.97.0`, amd64 manifest
  `sha256:08b7c1d35c3d1ef46a6814472e6441985b25dec4d6f32ae81aa91a6866c89fd1`.
  Distribution layer `sha256:a8512ea58e1aeac70dc6c5149848e1386c95d1962acd004c644b8fd5880f5430`.
  Nested `nexus-repository-nuget-3.97.0-13.jar` SHA-256
  `3b730a7446e4dc8d1224568de9796a2795bac7a3feddf83d8a6a6e64f0457f09`.
  No container was started for this source evidence.
- Official source commit `76b8303954ef1296507631aaabb69f980069a163`:
  SecurityComponent.authenticationToken, AuthTicketServiceImpl, ExtDirectServlet and AntiCsrfHelper.
- POST `/service/extdirect` invokes `rapture_Security.authenticationToken` with base64 username/password,
  type rpc and tid 1. Response action/method/type/tid/result are validated. Authentication requires
  requested username == authenticated principal. Tickets are bound to user/realm and redeemed once.
- GET `/service/rest/internal/nuget-api-key?authToken=<base64-ticket>` requires `nexus:apikey:read`,
  redeems the ticket and gets or creates the current principal's key. DELETE requires
  `nexus:apikey:delete`, redeems the ticket and deletes/replaces that key. Both return `{apiKey}`.
- An invocation-local random NX-ANTI-CSRF-TOKEN cookie/header pair accompanies requests. Basic
  authentication avoids persisted browser sessions; Nexus also accepts matching CSRF cookie/header.
  Redirects, service refusals, malformed/oversized responses and transport uncertainty fail without retry.

These internal operations are outside the public Swagger inventory; no public NuGet key or Pro User
Token endpoint is assumed. Other versions/editions and real-service write entitlement are not proven
by this offline contract. Runtime 401/403/404 stays an explicit failure. The source protocol acceptance
and local artifact delivery authorization are recorded in #677; publication and live key access require
separate owner authorization.
