# Source-backed contracts

Nexus source: [release-3.96.3-01](https://github.com/sonatype/nexus-public/tree/release-3.96.3-01), tree `829f297c35984a5fac590a366e949cd9a9a2eb79`. Framework: [v0.6.0 pinned source](https://github.com/iXab3r/EyeAuras.CliFactory/tree/aebe591ac51422e8feaa1b061344db99e39ad173). These conclusions establish offline contracts, not live compatibility. S24 descriptions retain deferred design only.

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

Nexus consumes this API through published Core 0.6.0, release commit
`aebe591ac51422e8feaa1b061344db99e39ad173`. The exact registry dependency and lockfile
replace the temporary local artifact overlay.

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
