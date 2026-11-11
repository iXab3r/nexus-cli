# Source-backed contracts

Nexus source: [release-3.96.3-01](https://github.com/sonatype/nexus-public/tree/release-3.96.3-01), tree `829f297c35984a5fac590a366e949cd9a9a2eb79`. Framework: [v0.6.1 pinned source](https://github.com/iXab3r/EyeAuras.CliFactory/tree/c313194f8cd22547dae6ae8693a2771f3a5066f0). These conclusions establish offline contracts, not live compatibility. S24 descriptions retain deferred design only.

## Exact metadata integers

The pinned `AssetXO.fileSize` is `integer/int64`. Its full signed range cannot
be represented exactly by a JavaScript number. The approved
[#645 policy](https://github.com/iXab3r/nexus-cli/issues/645#issuecomment-6725968859)
uses numbers in the safe-integer range and exact decimal strings outside it.
Nexus metadata decoding uses native JSON parsing plus an iterative token scan,
then validates/normalizes `fileSize` on the known AssetXO positions (direct
records, pages and nested ComponentXO assets) and `size` on direct/list RepositoryXO
records. Unrelated subtrees are skipped
with a depth counter; they do not enter a recursive reviver. Unknown fields with
that spelling keep their existing representation.

Valid decimal/exponent JSON spellings of integral int64 values have the same
value. Nonintegral, wrong-type or out-of-range sizes fail without a rounded
result; body and page budgets/checkpoints still apply. Magnitude is checked
before zero padding or bounded BigInt conversion. This is a Nexus DTO policy,
not a generic Core JSON parser, download byte-accounting change or live proof.

## Reported repository metadata (Q4)

The public `repository/rest/api/RepositoryXO.java`, `RepositoriesResource.java` and
`RepositoryManagerRESTAdapterImpl.java` in the pinned source define the two general
repository GET responses; the unrelated internal RepositoryXO is not their DTO.
The public size is a nullable Java Long with NON_NULL serialization. Detail obtains
an optional metrics value and omits size when unavailable. List emits zero when its
optional metrics service or a repository's metrics row is absent. Preserve reported
zero and omission independently, without inferring measurement availability.

Both producers return only `proxy.remoteUrl` for proxy attributes and an empty map
otherwise. Detail reads a nullable String; list reads an object with an empty-string
default. The selected projection validates group objects and string/null remoteUrl,
retains empty/null/omitted values, and admits only HTTP(S) URLs after removing
userinfo/query/fragment; invalid/non-HTTP strings become null for display. Apply
the same URL projection to RepositoryXO.url. Other attributes/top-level unknown
fields are omitted. This is a private-field output projection, not complete
support for OpenAPI's arbitrary attributes map, so both operation rows stay partial.
No universal detection of sensitive URL path text or live compatibility is claimed.

The resource uses RequiresUser (known subject). List filters through
userCanBrowseRepositories; detail permits repository read/browse through the
permission checker, including applicable content-selector evaluation. Local
ReadOnly, Basic/anonymous modes and existing response/item budgets remain unchanged.

## Upload-field metadata (Q5)

The pinned public `rest/api/UploadDefinitionResource` converts both GET responses
with `UploadDefinitionXO.fromWithAssetFileField`. Root fields are format,
multipleUpload, componentFields and assetFields. It appends a synthetic asset
field named `asset`, type `FILE`, optional=false; preserve this server-returned
metadata rather than adding it locally or restricting type to the model enum.
Detail throws 404 for a missing definition or apiUpload=false. There is no explicit
permission annotation on the inspected resource methods; this does not establish
anonymous admission or live entitlement under the server's global security policy.

`UploadFieldDefinitionXO.from` maps name, type.name(), helpText→description,
optional, group, groupHelpText and options. Model constructors allow null help,
group, group help and whole options. Options describe SELECT choices as a
Map<String,String>; the DTO conversion does not remove maps supplied for another
type. Accept omitted/null/empty new metadata distinctly and preserve all own
string option entries safely, including prototype-like keys. The CLI's existing
label/response/field-count budgets and new text/map budgets are resource limits,
not source schema limits. Human controls are escaped without changing admitted
JSON/RPC strings. Unknown root/field properties stay private; recognized field
metadata is service data, not arbitrary configuration or inferred defaults.

## Hosted GET and PUT

Under `public/common/components/nexus-repository-services/src/main/java/org/sonatype/nexus/repository/rest/api/`, `AbstractRepositoriesApiResource.setConvertersByFormat` builds the qualifier map from injected adapters; GET selects the format adapter, falling back to the default. Raw V1 inherits the hosted resource GET. Under `public/common/components/formats/nexus-repository-raw/src/main/java/org/sonatype/nexus/repository/raw/`, `RawRepositoryAdapter` is `@Component @Qualifier(RawFormat.NAME)` and its hosted switch constructs `RawHostedApiRepository` with storage, cleanup, component and raw. Its getters serialize concrete properties despite the abstract OpenAPI return type. `RawRepositoryAdapterTest` supplies upstream coverage.

`SimpleApiRepositoryAdapter.getHostedStorageAttributes` returns blobStoreName, strictContentTypeValidation (default true) and writePolicy (ConfigurationConstants.WRITE_POLICY_DEFAULT = ALLOW); getComponentAttributes defaults proprietaryComponents=false; getCleanupPolicyAttributes returns null when cleanup is absent, otherwise policyNames default empty. `RawRepositoryAdapter.createRawAttributes` normalizes legacy null disposition to INLINE. When query forwarding feature is enabled the shared response also exposes nullable forwardQueryParameters and excludedQueryParameters default empty, including hosted responses. Their presence does NOT imply hosted PUT support.

`rest/RawHostedRepositoryApiRequestToConfigurationConverter.convert` calls `HostedRepositoryApiRequestToConfigurationConverter.convert`, which writes all three required storage fields, optional component.proprietaryComponents and cleanup.policyNames (set semantics). Abstract converter carries name/online and constructs configuration. Raw hosted converter writes only contentDisposition. `ContentDispositionHelper.resolveContentDisposition`: explicit value wins; omitted/null on update preserves stored value, including legacy null; create defaults ATTACHMENT. `RawProxyRepositoryApiRequestToConfigurationConverter` alone writes forwarding/exclusion fields, guarded by the feature flag. Hosted must not advertise them as writable.

Concrete S23 defaults: online=true, strictContentTypeValidation=true, writePolicy=ALLOW_ONCE, raw.contentDisposition=ATTACHMENT; cleanup omitted, component proprietaryComponents=false. These explicit CLI defaults are distinct from GET defaults. S24 projects name, online, full storage, recognized cleanup/component and supported raw disposition; omit format/type/url. Preserve false/empty values. GET normalizes legacy null, so byte-for-byte configuration preservation is impossible: promise supported effective settings only. Reject unknown fields or non-default hosted forwarding values before PUT, rather than silently claim preservation. No ETag/If-Match enforcement appears in this resource update path: GET/PUT can overwrite another writer. Recommend include S24 only with explicit owner acceptance of this limitation and exclusive administrative operation practice; no client reread makes it atomic.

## File destination: reviewed Core API

Core commit `5e05fe4c4cd77e605d517dd156a61104b4322f67` exports
`publishFile({ cwd, name, output?, maxBytes, signal, openResponse, inspectResponse, validateFile })`.
Downloads default to invocation cwd with a safe resource basename. Optional `--output`
accepts relative or absolute paths; the parent must exist. Core owns private same-directory
staging, exclusive no-clobber publication, identity checks and truthful published/cleanupFailed
errors. No implicit profile files or registration. The old profile publisher was removed.

Nexus consumes this API through published Core 0.6.1, release commit
`c313194f8cd22547dae6ae8693a2771f3a5066f0`. The exact registry dependency and lockfile
select the independently verified public-registry artifact. Historical local-overlay
evidence is retained separately and does not qualify this dependency.

The 0.6.1 source adds mixed-case percent-escape and control-safe diagnostic redaction,
preserves native error codes as causes, and adds tree views/table follow-ups. The
`publishFile` implementation is unchanged from 0.6.0; its existing exclusive publication,
identity checks, validation and cleanup contract still applies.

## Exact result rendering

`packages/core/src/cli.ts` handler catch paths around 373/426 call `writeResult(output, failure.result, json, presentation)` before rethrow. `output.ts` renders human presentation or JSON.stringify of the result. `cli.ts.report` at 618 writes diagnostics to error stream and returns machine error exitCode. For ordinary non-streamed JSON, stdout is the domain result JSON, stderr is `{error: MachineError}`; result is NOT nested in that stderr envelope. Human stdout is the same result's configured view; stderr message/cause, exit 1. Success stdout is result, not an invented success envelope. No result means no result stdout. Runtime run result also carries failure result (`cli.ts` failure mapping around 92).

`json-rpc.ts.errorData` adds result to error.data alongside machine fields. RPC protocol error has numeric code/message and data containing domain code, exitCode and result. RPC does not render human output or emit a second ordinary CLI stdout document. `stream-result.ts` preserves CliError.result when adding cause. For streamed JSON only, already emitted sequence stays stdout and cli.report includes result in stderr error metadata. Nexus initial pagination returns one bounded object, not a JSON sequence. Upstream `tests/failure.test.ts`, `stream-result.test.ts`, and integration paging tests cover failure result behavior. Packaged acceptance must assert these exact channels and RPC structure, not a generic envelope assumption.

## REST upload permissions and fields

`ComponentsResource.java.uploadComponent` is @RequiresUser; this is Shiro known-subject admission, distinct from @RequiresAuthentication. `RepositoryManagerRESTAdapterImpl.getRepository` gates repository resolution through `RepositoryPermissionChecker.userCanReadOrBrowse`: repository view BROWSE or READ, OR an active permitted content selector for either action. Selector repository-level evaluation uses format/repository; an undefined path exception is explicitly deferred to asset-level evaluation. This is not a blanket assertion that edit alone admits REST upload. `UploadManagerImpl` enforces online and hosted/handler availability; no client repository-list call needed.

`RawUploadHandlerSupport.handle` trims directory/filename, normalizes path, prefixes slash for datastore, calls UploadHandler.ensurePermitted for each path before writing. That calls ContentPermissionChecker.isPermitted with EDIT and resolved path variables. `ContentPermissionCheckerImpl` accepts repository-view EDIT OR an authorized active content selector whose expression evaluates true for the path/variables; selector evaluation error denies. RawUploadHandler writes via RawContentFacet after these checks. UI nx-component-upload is not checked by this REST chain. Raw fields: required raw.directory, binary raw.asset1, required raw.asset1.filename. CLI supplies directory explicitly (root `/` if requested); filename defaults to local basename as CLI policy, not server default.

`MavenUploadHandlerSupport.doValidation` validates coordinates/version policy and checks EDIT for each submitted asset path and Maven coordinate variables. MavenUploadHandler creates assets then maybeGeneratePom. Critical distinction: generatePom -> storeAssetContent -> MavenUploadHandler.doPut -> MavenContentFacet.put does not re-enter ensurePermitted for generated POM. MavenContentFacetImpl.put ingests/stores content; the inspected chain has no second POM content-selector check. Checksum sidecars are also generated by doPut. Therefore do not claim POM follows the JAR authorization check or promise path selectors constrain every generated file. Tests should model this source behavior; recommend documented repository-level edit permission for the supported generated-POM workflow. Do not invent a client permission probe or guarantee rollback.

Exact S19 fields: maven2.groupId, maven2.artifactId, maven2.version, maven2.packaging=jar, maven2.generate-pom=true, binary maven2.asset1, maven2.asset1.extension=jar; omit classifier. isGeneratePom accepts `on` or Boolean.parseBoolean true; omission defaults false. Packaging and generation flag are optional server fields; CLI sends both explicitly. Group/artifact/version and extension are required for this no-input-POM scenario. Generated path is groupId with dots replaced by slash / artifactId / version / artifactId-version.pom. Submitted JAR and generated POM/checksums mean success can create several assets, and failure can leave partial effects. ComponentUploadUtils supplies format prefixes and numbered asset parsing. No live privilege proof or vulnerability exploit was attempted.


## Maven original-POM import design (S25)

The pinned MavenUploadHandlerSupport.getBasePath/createBasePathFromPom source
selects coordinates from the supplied POM, inherits absent groupId/version from
its parent, and requires the project artifactId. Missing coordinates and leading
unresolved property expressions are server validation failures. The original POM
is the sole coordinate authority: preserve its bytes, send it as an unclassified
pom asset with generate-pom=false, and reject coordinate/generation flags in this
mode. The CLI performs no XML evaluation, dependency resolution or parent lookup;
this does not claim protection against all server XML-parser behavior.

Repeated JSON asset descriptors avoid path-delimiter ambiguity. Accept file and
extension plus optional classifier, at most16 assets plus the original POM.
Reserve the unclassified pom tuple and reject duplicate normalized suffix pairs.
Validate every local file before POST using the existing file-backed upload rules.
Prepared compound-extension signatures remain opaque assets, not a signing or
verification feature. One request does not imply transactional publication.

## Distribution response and internal-key contracts

The selected 3.97.0-13 source revision is `76b8303954ef1296507631aaabb69f980069a163`;
public request DTOs remain reproducibly pinned in the 3.96.3-01 OpenAPI. Read and write shapes
must remain distinct where the actual source differs. In the official 3.97.0-13 NuGet binary,
`NugetApiRepositoryAdapter.adapt(proxy)` calls `getHostedStorageAttributes`, passing that subtype
to `NugetProxyApiRepository` through the `StorageAttributes` parameter. Consequently a proxy GET
exposes `storage.writePolicy`, whereas its proxy mutation DTO does not represent that setting.
The CLI retains this read-only observation and rejects it in proxy mutation input. Nullable
connection/default fields remain observations rather than invented configuration values.

[ProxyAttributes](https://github.com/sonatype/nexus-public/blob/76b8303954ef1296507631aaabb69f980069a163/public/common/components/nexus-repository-services/src/main/java/org/sonatype/nexus/repository/rest/api/model/ProxyAttributes.java)
and the matching `ProxyRepositoryApiRequestToConfigurationConverter.convertProxy` preserve
`preserveEncodedCharacters`; its boolean constructor default is false. That field already exists
in the pinned public request schema and is preserved in proxy get/create/update.

The [repository privilege descriptor](https://github.com/sonatype/nexus-public/blob/76b8303954ef1296507631aaabb69f980069a163/public/common/components/nexus-repository-services/src/main/java/org/sonatype/nexus/repository/security/RepositoryViewPrivilegeDescriptor.java)
generates built-in IDs containing wildcard portions. The public privilege-name creation regex
is therefore not a grammar for all readable server identifiers. Reads accept actual nonempty
privilege names while mutation input retains the source creation constraint.

[NuGet key protocol](nuget-key-protocol.md) records the official image/layer/JAR digests,
principal-bound one-use reauthentication ticket, state-creating GET and DELETE replacement
semantics. Those internal operations are outside the public Swagger inventory. Static source
evidence is not a live mutation or permission-entitlement claim.
