# Generated API inventory

Version 3.96.3-01; 442 logical identities; 442 HTTP method/path pairs.

Every method/path is distinct; original operationId retained. Service-domain tracker roots preserve API semantics. This is a census, not implementation scope.

| Primary group | Logical | HTTP pairs |
|---|---:|---:|
| Azure blob store | 1 | 1 |
| Blob store | 20 | 20 |
| Capabilities | 5 | 5 |
| Cleanup policies | 5 | 5 |
| Community Edition Eula | 2 | 2 |
| Content selectors | 5 | 5 |
| Data Store | 2 | 2 |
| Email | 4 | 4 |
| Formats | 2 | 2 |
| Instance configuration | 7 | 7 |
| Internal UI: API permissions | 1 | 1 |
| Lifecycle | 3 | 3 |
| Malicious Risk On Disk | 2 | 2 |
| Manage Sonatype HTTP System Settings | 3 | 3 |
| Manage Sonatype Repository Firewall configuration | 11 | 11 |
| Monthly Metrics | 1 | 1 |
| Product licensing | 3 | 3 |
| Reconcile Plan | 9 | 9 |
| Recovery Mode | 2 | 2 |
| Repository Browse | 2 | 2 |
| Repository Management | 215 | 215 |
| Routing rules | 5 | 5 |
| Script | 6 | 6 |
| Search | 6 | 6 |
| Security Management: Anonymous Access | 2 | 2 |
| Security Management: SSRF Protection | 2 | 2 |
| Security management | 1 | 1 |
| Security management: API access | 1 | 1 |
| Security management: LDAP | 11 | 11 |
| Security management: SAML | 5 | 5 |
| Security management: SAML users | 5 | 5 |
| Security management: SAML users (v2) | 1 | 1 |
| Security management: api keys principals encryption | 1 | 1 |
| Security management: privileges | 15 | 15 |
| Security management: realms | 3 | 3 |
| Security management: roles | 6 | 6 |
| Security management: secrets encryption | 1 | 1 |
| Security management: user tokens | 4 | 4 |
| Security management: users | 9 | 9 |
| Security: Atlassian Crowd | 4 | 4 |
| Security: IP Allow List | 9 | 9 |
| Security: certificates | 4 | 4 |
| Staging | 2 | 2 |
| Status | 5 | 5 |
| Support | 2 | 2 |
| System: Nodes | 3 | 3 |
| Tags | 7 | 7 |
| Tasks | 9 | 9 |
| Usage History | 1 | 1 |
| assets | 3 | 3 |
| components | 4 | 4 |

## Operation identities

- `createAzureblobstoreTestConnection` (Azure blob store): `POST /v1/azureblobstore/test-connection`

- `createBlobstoresAzure` (Blob store): `POST /v1/blobstores/azure`

- `createBlobstoresFile` (Blob store): `POST /v1/blobstores/file`

- `createBlobstoresGoogle` (Blob store): `POST /v1/blobstores/google`

- `createBlobstoresGroup` (Blob store): `POST /v1/blobstores/group`

- `createBlobstoresGroupConvert` (Blob store): `POST /v1/blobstores/group/convert/{name}/{newNameForOriginal}`

- `createBlobstoresS3` (Blob store): `POST /v1/blobstores/s3`

- `createCapabilities` (Capabilities): `POST /v1/capabilities`

- `createCleanupPolicies` (Cleanup policies): `POST /v1/cleanup-policies`

- `createComponents` (components): `POST /v1/components`

- `createConfigurationAssetsImport` (Instance configuration): `POST /v1/configuration/assets/{repositoryName}/import`

- `createConfigurationCipher` (Instance configuration): `POST /v1/configuration/cipher`

- `createConfigurationTransferComplete` (Instance configuration): `POST /v1/configuration/transfer-complete`

- `createEmailVerify` (Email): `POST /v1/email/verify`

- `createInternalUiSecurityAccessCheck` (Security management: API access): `POST /internal/ui/security/access-check`

- `createIqCapabilitiesTest` (Manage Sonatype Repository Firewall configuration): `POST /v1/iq/capabilities/test`

- `createIqDisable` (Manage Sonatype Repository Firewall configuration): `POST /v1/iq/disable`

- `createIqEnable` (Manage Sonatype Repository Firewall configuration): `POST /v1/iq/enable`

- `createIqTestNewConnection` (Manage Sonatype Repository Firewall configuration): `POST /v1/iq/test-new-connection`

- `createIqVerifyConnection` (Manage Sonatype Repository Firewall configuration): `POST /v1/iq/verify-connection`

- `createPlan` (Reconcile Plan): `POST /v1/plan`

- `createRecoveryMode` (Recovery Mode): `POST /v1/recovery-mode`

- `createRepositoriesAlpineGroup` (Repository Management / alpine / group): `POST /v1/repositories/alpine/group`

- `createRepositoriesAlpineHosted` (Repository Management / alpine / hosted): `POST /v1/repositories/alpine/hosted`

- `createRepositoriesAlpineProxy` (Repository Management / alpine / proxy): `POST /v1/repositories/alpine/proxy`

- `createRepositoriesAnsiblegalaxyGroup` (Repository Management / ansiblegalaxy / group): `POST /v1/repositories/ansiblegalaxy/group`

- `createRepositoriesAnsiblegalaxyHosted` (Repository Management / ansiblegalaxy / hosted): `POST /v1/repositories/ansiblegalaxy/hosted`

- `createRepositoriesAnsiblegalaxyProxy` (Repository Management / ansiblegalaxy / proxy): `POST /v1/repositories/ansiblegalaxy/proxy`

- `createRepositoriesAptHosted` (Repository Management / apt / hosted): `POST /v1/repositories/apt/hosted`

- `createRepositoriesAptProxy` (Repository Management / apt / proxy): `POST /v1/repositories/apt/proxy`

- `createRepositoriesCargoGroup` (Repository Management / cargo / group): `POST /v1/repositories/cargo/group`

- `createRepositoriesCargoHosted` (Repository Management / cargo / hosted): `POST /v1/repositories/cargo/hosted`

- `createRepositoriesCargoProxy` (Repository Management / cargo / proxy): `POST /v1/repositories/cargo/proxy`

- `createRepositoriesCocoapodsProxy` (Repository Management / cocoapods / proxy): `POST /v1/repositories/cocoapods/proxy`

- `createRepositoriesComposerGroup` (Repository Management / composer / group): `POST /v1/repositories/composer/group`

- `createRepositoriesComposerHosted` (Repository Management / composer / hosted): `POST /v1/repositories/composer/hosted`

- `createRepositoriesComposerProxy` (Repository Management / composer / proxy): `POST /v1/repositories/composer/proxy`

- `createRepositoriesConanGroup` (Repository Management / conan / group): `POST /v1/repositories/conan/group`

- `createRepositoriesConanHosted` (Repository Management / conan / hosted): `POST /v1/repositories/conan/hosted`

- `createRepositoriesConanProxy` (Repository Management / conan / proxy): `POST /v1/repositories/conan/proxy`

- `createRepositoriesCondaGroup` (Repository Management / conda / group): `POST /v1/repositories/conda/group`

- `createRepositoriesCondaHosted` (Repository Management / conda / hosted): `POST /v1/repositories/conda/hosted`

- `createRepositoriesCondaProxy` (Repository Management / conda / proxy): `POST /v1/repositories/conda/proxy`

- `createRepositoriesDockerGroup` (Repository Management / docker / group): `POST /v1/repositories/docker/group`

- `createRepositoriesDockerHosted` (Repository Management / docker / hosted): `POST /v1/repositories/docker/hosted`

- `createRepositoriesDockerProxy` (Repository Management / docker / proxy): `POST /v1/repositories/docker/proxy`

- `createRepositoriesGitlfsHosted` (Repository Management / gitlfs / hosted): `POST /v1/repositories/gitlfs/hosted`

- `createRepositoriesGoGroup` (Repository Management / go / group): `POST /v1/repositories/go/group`

- `createRepositoriesGoHosted` (Repository Management / go / hosted): `POST /v1/repositories/go/hosted`

- `createRepositoriesGoProxy` (Repository Management / go / proxy): `POST /v1/repositories/go/proxy`

- `createRepositoriesHealthCheck` (Repository Management / General): `POST /v1/repositories/{repositoryName}/health-check`

- `createRepositoriesHelmGroup` (Repository Management / helm / group): `POST /v1/repositories/helm/group`

- `createRepositoriesHelmHosted` (Repository Management / helm / hosted): `POST /v1/repositories/helm/hosted`

- `createRepositoriesHelmProxy` (Repository Management / helm / proxy): `POST /v1/repositories/helm/proxy`

- `createRepositoriesHuggingfaceProxy` (Repository Management / huggingface / proxy): `POST /v1/repositories/huggingface/proxy`

- `createRepositoriesInvalidateCache` (Repository Management / General): `POST /v1/repositories/{repositoryName}/invalidate-cache`

- `createRepositoriesMavenGroup` (Repository Management / maven / group): `POST /v1/repositories/maven/group`

- `createRepositoriesMavenHosted` (Repository Management / maven / hosted): `POST /v1/repositories/maven/hosted`

- `createRepositoriesMavenProxy` (Repository Management / maven / proxy): `POST /v1/repositories/maven/proxy`

- `createRepositoriesNpmGroup` (Repository Management / npm / group): `POST /v1/repositories/npm/group`

- `createRepositoriesNpmHosted` (Repository Management / npm / hosted): `POST /v1/repositories/npm/hosted`

- `createRepositoriesNpmProxy` (Repository Management / npm / proxy): `POST /v1/repositories/npm/proxy`

- `createRepositoriesNugetGroup` (Repository Management / nuget / group): `POST /v1/repositories/nuget/group`

- `createRepositoriesNugetHosted` (Repository Management / nuget / hosted): `POST /v1/repositories/nuget/hosted`

- `createRepositoriesNugetProxy` (Repository Management / nuget / proxy): `POST /v1/repositories/nuget/proxy`

- `createRepositoriesOciGroup` (Repository Management / oci / group): `POST /v1/repositories/oci/group`

- `createRepositoriesOciHosted` (Repository Management / oci / hosted): `POST /v1/repositories/oci/hosted`

- `createRepositoriesOciProxy` (Repository Management / oci / proxy): `POST /v1/repositories/oci/proxy`

- `createRepositoriesP2Proxy` (Repository Management / p2 / proxy): `POST /v1/repositories/p2/proxy`

- `createRepositoriesPubGroup` (Repository Management / pub / group): `POST /v1/repositories/pub/group`

- `createRepositoriesPubHosted` (Repository Management / pub / hosted): `POST /v1/repositories/pub/hosted`

- `createRepositoriesPubProxy` (Repository Management / pub / proxy): `POST /v1/repositories/pub/proxy`

- `createRepositoriesPypiGroup` (Repository Management / pypi / group): `POST /v1/repositories/pypi/group`

- `createRepositoriesPypiHosted` (Repository Management / pypi / hosted): `POST /v1/repositories/pypi/hosted`

- `createRepositoriesPypiProxy` (Repository Management / pypi / proxy): `POST /v1/repositories/pypi/proxy`

- `createRepositoriesRGroup` (Repository Management / r / group): `POST /v1/repositories/r/group`

- `createRepositoriesRHosted` (Repository Management / r / hosted): `POST /v1/repositories/r/hosted`

- `createRepositoriesRProxy` (Repository Management / r / proxy): `POST /v1/repositories/r/proxy`

- `createRepositoriesRawGroup` (Repository Management / raw / group): `POST /v1/repositories/raw/group`

- `createRepositoriesRawHosted` (Repository Management / raw / hosted): `POST /v1/repositories/raw/hosted`

- `createRepositoriesRawProxy` (Repository Management / raw / proxy): `POST /v1/repositories/raw/proxy`

- `createRepositoriesRebuildIndex` (Repository Management / General): `POST /v1/repositories/{repositoryName}/rebuild-index`

- `createRepositoriesRubygemsGroup` (Repository Management / rubygems / group): `POST /v1/repositories/rubygems/group`

- `createRepositoriesRubygemsHosted` (Repository Management / rubygems / hosted): `POST /v1/repositories/rubygems/hosted`

- `createRepositoriesRubygemsProxy` (Repository Management / rubygems / proxy): `POST /v1/repositories/rubygems/proxy`

- `createRepositoriesSwiftGroup` (Repository Management / swift / group): `POST /v1/repositories/swift/group`

- `createRepositoriesSwiftHosted` (Repository Management / swift / hosted): `POST /v1/repositories/swift/hosted`

- `createRepositoriesSwiftProxy` (Repository Management / swift / proxy): `POST /v1/repositories/swift/proxy`

- `createRepositoriesTerraformGroup` (Repository Management / terraform / group): `POST /v1/repositories/terraform/group`

- `createRepositoriesTerraformHosted` (Repository Management / terraform / hosted): `POST /v1/repositories/terraform/hosted`

- `createRepositoriesTerraformProxy` (Repository Management / terraform / proxy): `POST /v1/repositories/terraform/proxy`

- `createRepositoriesYumGroup` (Repository Management / yum / group): `POST /v1/repositories/yum/group`

- `createRepositoriesYumHosted` (Repository Management / yum / hosted): `POST /v1/repositories/yum/hosted`

- `createRepositoriesYumProxy` (Repository Management / yum / proxy): `POST /v1/repositories/yum/proxy`

- `createRoutingRules` (Routing rules): `POST /v1/routing-rules`

- `createScript` (Script): `POST /v1/script`

- `createScriptRun` (Script): `POST /v1/script/{name}/run`

- `createSecurityAtlassianCrowdClearCache` (Security: Atlassian Crowd): `POST /v1/security/atlassian-crowd/clear-cache`

- `createSecurityAtlassianCrowdVerifyConnection` (Security: Atlassian Crowd): `POST /v1/security/atlassian-crowd/verify-connection`

- `createSecurityContentSelectors` (Content selectors): `POST /v1/security/content-selectors`

- `createSecurityIpAllowlistEntries` (Security: IP Allow List): `POST /v1/security/ip-allowlist/entries`

- `createSecurityIpAllowlistEntriesBulk` (Security: IP Allow List): `POST /v1/security/ip-allowlist/entries/bulk`

- `createSecurityLdap` (Security management: LDAP): `POST /v1/security/ldap`

- `createSecurityLdapChangeOrder` (Security management: LDAP): `POST /v1/security/ldap/change-order`

- `createSecurityLdapVerifyConnection` (Security management: LDAP): `POST /v1/security/ldap/verify-connection`

- `createSecurityLdapVerifyLogin` (Security management: LDAP): `POST /v1/security/ldap/verify-login`

- `createSecurityLdapVerifyUserMapping` (Security management: LDAP): `POST /v1/security/ldap/verify-user-mapping`

- `createSecurityPrivilegesApplication` (Security management: privileges): `POST /v1/security/privileges/application`

- `createSecurityPrivilegesRepositoryAdmin` (Security management: privileges): `POST /v1/security/privileges/repository-admin`

- `createSecurityPrivilegesRepositoryContentSelector` (Security management: privileges): `POST /v1/security/privileges/repository-content-selector`

- `createSecurityPrivilegesRepositoryView` (Security management: privileges): `POST /v1/security/privileges/repository-view`

- `createSecurityPrivilegesScript` (Security management: privileges): `POST /v1/security/privileges/script`

- `createSecurityPrivilegesWildcard` (Security management: privileges): `POST /v1/security/privileges/wildcard`

- `createSecurityRoles` (Security management: roles): `POST /v1/security/roles`

- `createSecuritySamlUsers` (Security management: SAML users): `POST /v1/security/saml/users`

- `createSecuritySslTruststore` (Security: certificates): `POST /v1/security/ssl/truststore`

- `createSecurityUsers` (Security management: users): `POST /v1/security/users`

- `createSecurityUsersUserToken` (Security management: users): `POST /v1/security/users/{userId}/{realm}/user-token`

- `createStagingDelete` (Staging): `POST /v1/staging/delete`

- `createStagingMove` (Staging): `POST /v1/staging/move/{destination}`

- `createSupportSupportzip` (Support): `POST /v1/support/supportzip`

- `createSupportSupportzippath` (Support): `POST /v1/support/supportzippath`

- `createSystemEula` (Community Edition Eula): `POST /v1/system/eula`

- `createSystemLicense` (Product licensing): `POST /v1/system/license`

- `createTags` (Tags): `POST /v1/tags`

- `createTagsAssociate` (Tags): `POST /v1/tags/associate/{tagName}`

- `createTasks` (Tasks): `POST /v1/tasks`

- `createTasksRun` (Tasks): `POST /v1/tasks/{id}/run`

- `createTasksStop` (Tasks): `POST /v1/tasks/{id}/stop`

- `deleteAssets` (assets): `DELETE /v1/assets/{id}`

- `deleteBlobstores` (Blob store): `DELETE /v1/blobstores/{name}`

- `deleteCapabilities` (Capabilities): `DELETE /v1/capabilities/{capabilityId}`

- `deleteCleanupPolicies` (Cleanup policies): `DELETE /v1/cleanup-policies/{name}`

- `deleteComponents` (components): `DELETE /v1/components/{id}`

- `deleteConfigurationCipher` (Instance configuration): `DELETE /v1/configuration/cipher`

- `deleteEmail` (Email): `DELETE /v1/email`

- `deleteHttp` (Manage Sonatype HTTP System Settings): `DELETE /v1/http`

- `deletePlan :: DELETE /v1/plan` (Reconcile Plan): `DELETE /v1/plan`

- `deletePlan :: DELETE /v1/plan/{planId}` (Reconcile Plan): `DELETE /v1/plan/{planId}`

- `deleteRecoveryMode` (Recovery Mode): `DELETE /v1/recovery-mode`

- `deleteRepositories` (Repository Management / General): `DELETE /v1/repositories/{repositoryName}`

- `deleteRepositoriesBrowse` (Repository Browse): `DELETE /v1/repositories/{repositoryName}/browse`

- `deleteRepositoriesHealthCheck` (Repository Management / General): `DELETE /v1/repositories/{repositoryName}/health-check`

- `deleteRoutingRules` (Routing rules): `DELETE /v1/routing-rules/{name}`

- `deleteScript` (Script): `DELETE /v1/script/{name}`

- `deleteSecurityContentSelectors` (Content selectors): `DELETE /v1/security/content-selectors/{name}`

- `deleteSecurityIpAllowlistEntries` (Security: IP Allow List): `DELETE /v1/security/ip-allowlist/entries`

- `deleteSecurityIpAllowlistEntriesBulk` (Security: IP Allow List): `DELETE /v1/security/ip-allowlist/entries/bulk`

- `deleteSecurityLdap` (Security management: LDAP): `DELETE /v1/security/ldap/{name}`

- `deleteSecurityLdapCache` (Security management: LDAP): `DELETE /v1/security/ldap/cache`

- `deleteSecurityPrivileges` (Security management: privileges): `DELETE /v1/security/privileges/{privilegeName}`

- `deleteSecurityRoles` (Security management: roles): `DELETE /v1/security/roles/{id}`

- `deleteSecuritySaml` (Security management: SAML): `DELETE /v1/security/saml`

- `deleteSecuritySamlUsers` (Security management: SAML users): `DELETE /v1/security/saml/users/{userId}`

- `deleteSecuritySslTruststore` (Security: certificates): `DELETE /v1/security/ssl/truststore/{id}`

- `deleteSecurityUserTokens` (Security management: user tokens): `DELETE /v1/security/user-tokens`

- `deleteSecurityUsers` (Security management: users): `DELETE /v1/security/users/{userId}`

- `deleteSecurityUsersUserToken` (Security management: users): `DELETE /v1/security/users/{userId}/{realm}/user-token`

- `deleteSecurityUsersUserTokenReset` (Security management: users): `DELETE /v1/security/users/{userId}/{realm}/user-token-reset`

- `deleteSystemLicense` (Product licensing): `DELETE /v1/system/license`

- `deleteSystemNode` (System: Nodes): `DELETE /v1/system/node`

- `deleteTags` (Tags): `DELETE /v1/tags/{name}`

- `deleteTagsAssociate` (Tags): `DELETE /v1/tags/associate/{tagName}`

- `deleteTasks` (Tasks): `DELETE /v1/tasks/{id}`

- `getAssets` (assets): `GET /v1/assets/{id}`

- `getBlobstoresAzure` (Blob store): `GET /v1/blobstores/azure/{name}`

- `getBlobstoresFile` (Blob store): `GET /v1/blobstores/file/{name}`

- `getBlobstoresGoogle` (Blob store): `GET /v1/blobstores/google/{name}`

- `getBlobstoresGoogleRegions` (Blob store): `GET /v1/blobstores/google/regions/{projectId}`

- `getBlobstoresGroup` (Blob store): `GET /v1/blobstores/group/{name}`

- `getBlobstoresQuotaStatus` (Blob store): `GET /v1/blobstores/{name}/quota-status`

- `getBlobstoresS3` (Blob store): `GET /v1/blobstores/s3/{name}`

- `getCleanupPolicies` (Cleanup policies): `GET /v1/cleanup-policies/{name}`

- `getComponents` (components): `GET /v1/components/{id}`

- `getFormatsUploadSpecs` (Formats): `GET /v1/formats/{format}/upload-specs`

- `getIqAudit` (Manage Sonatype Repository Firewall configuration): `GET /v1/iq/audit/{repositoryName}`

- `getPlan` (Reconcile Plan): `GET /v1/plan/{planId}`

- `getRepositories` (Repository Management / General): `GET /v1/repositories/{repositoryName}`

- `getRepositoriesAlpineGroup` (Repository Management / alpine / group): `GET /v1/repositories/alpine/group/{repositoryName}`

- `getRepositoriesAlpineHosted` (Repository Management / alpine / hosted): `GET /v1/repositories/alpine/hosted/{repositoryName}`

- `getRepositoriesAlpineProxy` (Repository Management / alpine / proxy): `GET /v1/repositories/alpine/proxy/{repositoryName}`

- `getRepositoriesAnsiblegalaxyGroup` (Repository Management / ansiblegalaxy / group): `GET /v1/repositories/ansiblegalaxy/group/{repositoryName}`

- `getRepositoriesAnsiblegalaxyHosted` (Repository Management / ansiblegalaxy / hosted): `GET /v1/repositories/ansiblegalaxy/hosted/{repositoryName}`

- `getRepositoriesAnsiblegalaxyProxy` (Repository Management / ansiblegalaxy / proxy): `GET /v1/repositories/ansiblegalaxy/proxy/{repositoryName}`

- `getRepositoriesAptHosted` (Repository Management / apt / hosted): `GET /v1/repositories/apt/hosted/{repositoryName}`

- `getRepositoriesAptProxy` (Repository Management / apt / proxy): `GET /v1/repositories/apt/proxy/{repositoryName}`

- `getRepositoriesBrowse` (Repository Browse): `GET /v1/repositories/{repositoryName}/browse`

- `getRepositoriesCargoGroup` (Repository Management / cargo / group): `GET /v1/repositories/cargo/group/{repositoryName}`

- `getRepositoriesCargoHosted` (Repository Management / cargo / hosted): `GET /v1/repositories/cargo/hosted/{repositoryName}`

- `getRepositoriesCargoProxy` (Repository Management / cargo / proxy): `GET /v1/repositories/cargo/proxy/{repositoryName}`

- `getRepositoriesCocoapodsProxy` (Repository Management / cocoapods / proxy): `GET /v1/repositories/cocoapods/proxy/{repositoryName}`

- `getRepositoriesComposerGroup` (Repository Management / composer / group): `GET /v1/repositories/composer/group/{repositoryName}`

- `getRepositoriesComposerHosted` (Repository Management / composer / hosted): `GET /v1/repositories/composer/hosted/{repositoryName}`

- `getRepositoriesComposerProxy` (Repository Management / composer / proxy): `GET /v1/repositories/composer/proxy/{repositoryName}`

- `getRepositoriesConanGroup` (Repository Management / conan / group): `GET /v1/repositories/conan/group/{repositoryName}`

- `getRepositoriesConanHosted` (Repository Management / conan / hosted): `GET /v1/repositories/conan/hosted/{repositoryName}`

- `getRepositoriesConanProxy` (Repository Management / conan / proxy): `GET /v1/repositories/conan/proxy/{repositoryName}`

- `getRepositoriesCondaGroup` (Repository Management / conda / group): `GET /v1/repositories/conda/group/{repositoryName}`

- `getRepositoriesCondaHosted` (Repository Management / conda / hosted): `GET /v1/repositories/conda/hosted/{repositoryName}`

- `getRepositoriesCondaProxy` (Repository Management / conda / proxy): `GET /v1/repositories/conda/proxy/{repositoryName}`

- `getRepositoriesDockerGroup` (Repository Management / docker / group): `GET /v1/repositories/docker/group/{repositoryName}`

- `getRepositoriesDockerHosted` (Repository Management / docker / hosted): `GET /v1/repositories/docker/hosted/{repositoryName}`

- `getRepositoriesDockerProxy` (Repository Management / docker / proxy): `GET /v1/repositories/docker/proxy/{repositoryName}`

- `getRepositoriesGitlfsHosted` (Repository Management / gitlfs / hosted): `GET /v1/repositories/gitlfs/hosted/{repositoryName}`

- `getRepositoriesGoGroup` (Repository Management / go / group): `GET /v1/repositories/go/group/{repositoryName}`

- `getRepositoriesGoHosted` (Repository Management / go / hosted): `GET /v1/repositories/go/hosted/{repositoryName}`

- `getRepositoriesGoProxy` (Repository Management / go / proxy): `GET /v1/repositories/go/proxy/{repositoryName}`

- `getRepositoriesHelmGroup` (Repository Management / helm / group): `GET /v1/repositories/helm/group/{repositoryName}`

- `getRepositoriesHelmHosted` (Repository Management / helm / hosted): `GET /v1/repositories/helm/hosted/{repositoryName}`

- `getRepositoriesHelmProxy` (Repository Management / helm / proxy): `GET /v1/repositories/helm/proxy/{repositoryName}`

- `getRepositoriesHuggingfaceProxy` (Repository Management / huggingface / proxy): `GET /v1/repositories/huggingface/proxy/{repositoryName}`

- `getRepositoriesMavenGroup` (Repository Management / maven / group): `GET /v1/repositories/maven/group/{repositoryName}`

- `getRepositoriesMavenHosted` (Repository Management / maven / hosted): `GET /v1/repositories/maven/hosted/{repositoryName}`

- `getRepositoriesMavenProxy` (Repository Management / maven / proxy): `GET /v1/repositories/maven/proxy/{repositoryName}`

- `getRepositoriesNpmGroup` (Repository Management / npm / group): `GET /v1/repositories/npm/group/{repositoryName}`

- `getRepositoriesNpmHosted` (Repository Management / npm / hosted): `GET /v1/repositories/npm/hosted/{repositoryName}`

- `getRepositoriesNpmProxy` (Repository Management / npm / proxy): `GET /v1/repositories/npm/proxy/{repositoryName}`

- `getRepositoriesNugetGroup` (Repository Management / nuget / group): `GET /v1/repositories/nuget/group/{repositoryName}`

- `getRepositoriesNugetHosted` (Repository Management / nuget / hosted): `GET /v1/repositories/nuget/hosted/{repositoryName}`

- `getRepositoriesNugetProxy` (Repository Management / nuget / proxy): `GET /v1/repositories/nuget/proxy/{repositoryName}`

- `getRepositoriesOciGroup` (Repository Management / oci / group): `GET /v1/repositories/oci/group/{repositoryName}`

- `getRepositoriesOciHosted` (Repository Management / oci / hosted): `GET /v1/repositories/oci/hosted/{repositoryName}`

- `getRepositoriesOciProxy` (Repository Management / oci / proxy): `GET /v1/repositories/oci/proxy/{repositoryName}`

- `getRepositoriesP2Proxy` (Repository Management / p2 / proxy): `GET /v1/repositories/p2/proxy/{repositoryName}`

- `getRepositoriesPubGroup` (Repository Management / pub / group): `GET /v1/repositories/pub/group/{repositoryName}`

- `getRepositoriesPubHosted` (Repository Management / pub / hosted): `GET /v1/repositories/pub/hosted/{repositoryName}`

- `getRepositoriesPubProxy` (Repository Management / pub / proxy): `GET /v1/repositories/pub/proxy/{repositoryName}`

- `getRepositoriesPypiGroup` (Repository Management / pypi / group): `GET /v1/repositories/pypi/group/{repositoryName}`

- `getRepositoriesPypiHosted` (Repository Management / pypi / hosted): `GET /v1/repositories/pypi/hosted/{repositoryName}`

- `getRepositoriesPypiProxy` (Repository Management / pypi / proxy): `GET /v1/repositories/pypi/proxy/{repositoryName}`

- `getRepositoriesRGroup` (Repository Management / r / group): `GET /v1/repositories/r/group/{repositoryName}`

- `getRepositoriesRHosted` (Repository Management / r / hosted): `GET /v1/repositories/r/hosted/{repositoryName}`

- `getRepositoriesRProxy` (Repository Management / r / proxy): `GET /v1/repositories/r/proxy/{repositoryName}`

- `getRepositoriesRawGroup` (Repository Management / raw / group): `GET /v1/repositories/raw/group/{repositoryName}`

- `getRepositoriesRawHosted` (Repository Management / raw / hosted): `GET /v1/repositories/raw/hosted/{repositoryName}`

- `getRepositoriesRawProxy` (Repository Management / raw / proxy): `GET /v1/repositories/raw/proxy/{repositoryName}`

- `getRepositoriesRubygemsGroup` (Repository Management / rubygems / group): `GET /v1/repositories/rubygems/group/{repositoryName}`

- `getRepositoriesRubygemsHosted` (Repository Management / rubygems / hosted): `GET /v1/repositories/rubygems/hosted/{repositoryName}`

- `getRepositoriesRubygemsProxy` (Repository Management / rubygems / proxy): `GET /v1/repositories/rubygems/proxy/{repositoryName}`

- `getRepositoriesSwiftGroup` (Repository Management / swift / group): `GET /v1/repositories/swift/group/{repositoryName}`

- `getRepositoriesSwiftHosted` (Repository Management / swift / hosted): `GET /v1/repositories/swift/hosted/{repositoryName}`

- `getRepositoriesSwiftProxy` (Repository Management / swift / proxy): `GET /v1/repositories/swift/proxy/{repositoryName}`

- `getRepositoriesTerraformGroup` (Repository Management / terraform / group): `GET /v1/repositories/terraform/group/{repositoryName}`

- `getRepositoriesTerraformHosted` (Repository Management / terraform / hosted): `GET /v1/repositories/terraform/hosted/{repositoryName}`

- `getRepositoriesTerraformProxy` (Repository Management / terraform / proxy): `GET /v1/repositories/terraform/proxy/{repositoryName}`

- `getRepositoriesYumGroup` (Repository Management / yum / group): `GET /v1/repositories/yum/group/{repositoryName}`

- `getRepositoriesYumHosted` (Repository Management / yum / hosted): `GET /v1/repositories/yum/hosted/{repositoryName}`

- `getRepositoriesYumProxy` (Repository Management / yum / proxy): `GET /v1/repositories/yum/proxy/{repositoryName}`

- `getRoutingRules` (Routing rules): `GET /v1/routing-rules/{name}`

- `getScript` (Script): `GET /v1/script/{name}`

- `getSecurityContentSelectors` (Content selectors): `GET /v1/security/content-selectors/{name}`

- `getSecurityLdap` (Security management: LDAP): `GET /v1/security/ldap/{name}`

- `getSecurityPrivileges` (Security management: privileges): `GET /v1/security/privileges/{privilegeName}`

- `getSecurityRoles` (Security management: roles): `GET /v1/security/roles/{id}`

- `getSecuritySamlUsers` (Security management: SAML users): `GET /v1/security/saml/users/{userId}`

- `getSecurityUsersUserToken` (Security management: users): `GET /v1/security/users/{userId}/{realm}/user-token`

- `getStatusCheck` (Status): `GET /beta/status/check/{nodeId}`

- `getTags` (Tags): `GET /v1/tags/{name}`

- `getTasks` (Tasks): `GET /v1/tasks/{id}`

- `getTasksTemplates` (Tasks): `GET /v1/tasks/templates/{typeId}`

- `listAssets` (assets): `GET /v1/assets`

- `listBlobstores` (Blob store): `GET /v1/blobstores`

- `listCapabilities` (Capabilities): `GET /v1/capabilities`

- `listCapabilitiesTypes` (Capabilities): `GET /v1/capabilities/types`

- `listCleanupPolicies` (Cleanup policies): `GET /v1/cleanup-policies`

- `listComponents` (components): `GET /v1/components`

- `listConfiguration` (Instance configuration): `GET /v1/configuration`

- `listConfigurationAssets` (Instance configuration): `GET /v1/configuration/assets`

- `listDataStore` (Data Store): `GET /beta/data-store`

- `listEmail` (Email): `GET /v1/email`

- `listFormatsUploadSpecs` (Formats): `GET /v1/formats/upload-specs`

- `listHttp` (Manage Sonatype HTTP System Settings): `GET /v1/http`

- `listInternalUiApiPermissions` (Internal UI: API permissions): `GET /internal/ui/api/permissions`

- `listIq` (Manage Sonatype Repository Firewall configuration): `GET /v1/iq`

- `listIqAudit` (Manage Sonatype Repository Firewall configuration): `GET /v1/iq/audit`

- `listIqCapabilities` (Manage Sonatype Repository Firewall configuration): `GET /v1/iq/capabilities`

- `listLifecyclePhase` (Lifecycle): `GET /v1/lifecycle/phase`

- `listMaliciousRiskEnabledRegistries` (Malicious Risk On Disk): `GET /v1/malicious-risk/enabledRegistries`

- `listMaliciousRiskRiskOnDisk` (Malicious Risk On Disk): `GET /v1/malicious-risk/risk-on-disk`

- `listMonthlyMetrics` (Monthly Metrics): `GET /v1/monthly-metrics`

- `listPlan` (Reconcile Plan): `GET /v1/plan`

- `listPlanDetails` (Reconcile Plan): `GET /v1/plan/details`

- `listPlanSummary` (Reconcile Plan): `GET /v1/plan/summary`

- `listRepositories` (Repository Management / General): `GET /v1/repositories`

- `listRepositorySettings` (Repository Management / General): `GET /v1/repositorySettings`

- `listRoutingRules` (Routing rules): `GET /v1/routing-rules`

- `listScript` (Script): `GET /v1/script`

- `listSearch` (Search): `GET /v1/search`

- `listSearchAssets` (Search): `GET /v1/search/assets`

- `listSearchAssetsDownload` (Search): `GET /v1/search/assets/download`

- `listSearchRepositories` (Search): `GET /v1/search/repositories`

- `listSearchSuggest` (Search): `GET /v1/search/suggest`

- `listSearchVersions` (Search): `GET /v1/search/versions`

- `listSecurityAnonymous` (Security Management: Anonymous Access): `GET /v1/security/anonymous`

- `listSecurityAtlassianCrowd` (Security: Atlassian Crowd): `GET /v1/security/atlassian-crowd`

- `listSecurityContentSelectors` (Content selectors): `GET /v1/security/content-selectors`

- `listSecurityIpAllowlist` (Security: IP Allow List): `GET /v1/security/ip-allowlist`

- `listSecurityIpAllowlistCurrentIp` (Security: IP Allow List): `GET /v1/security/ip-allowlist/current-ip`

- `listSecurityIpAllowlistEntries` (Security: IP Allow List): `GET /v1/security/ip-allowlist/entries`

- `listSecurityLdap` (Security management: LDAP): `GET /v1/security/ldap`

- `listSecurityLdapTemplates` (Security management: LDAP): `GET /v1/security/ldap/templates`

- `listSecurityPrivileges` (Security management: privileges): `GET /v1/security/privileges`

- `listSecurityRealmsActive` (Security management: realms): `GET /v1/security/realms/active`

- `listSecurityRealmsAvailable` (Security management: realms): `GET /v1/security/realms/available`

- `listSecurityRoles` (Security management: roles): `GET /v1/security/roles`

- `listSecurityRolesAssignable` (Security management: roles): `GET /v1/security/roles/assignable`

- `listSecuritySaml` (Security management: SAML): `GET /v1/security/saml`

- `listSecuritySamlMetadata` (Security management: SAML): `GET /v1/security/saml/metadata`

- `listSecuritySamlPem` (Security management: SAML): `GET /v1/security/saml/pem`

- `listSecuritySamlUsers :: GET /v1/security/saml/users` (Security management: SAML users): `GET /v1/security/saml/users`

- `listSecuritySamlUsers :: GET /v2/security/saml/users` (Security management: SAML users (v2)): `GET /v2/security/saml/users`

- `listSecuritySsl` (Security: certificates): `GET /v1/security/ssl`

- `listSecuritySslTruststore` (Security: certificates): `GET /v1/security/ssl/truststore`

- `listSecuritySsrfProtection` (Security Management: SSRF Protection): `GET /v1/security/ssrf-protection`

- `listSecurityUserSources` (Security management): `GET /v1/security/user-sources`

- `listSecurityUserTokens` (Security management: user tokens): `GET /v1/security/user-tokens`

- `listSecurityUserTokensTokens` (Security management: user tokens): `GET /v1/security/user-tokens/tokens`

- `listSecurityUsers` (Security management: users): `GET /v1/security/users`

- `listStatus` (Status): `GET /v1/status`

- `listStatusCheck` (Status): `GET /v1/status/check`

- `listStatusCheckCluster` (Status): `GET /beta/status/check/cluster`

- `listStatusWritable` (Status): `GET /v1/status/writable`

- `listSystemEula` (Community Edition Eula): `GET /v1/system/eula`

- `listSystemInformation` (System: Nodes): `GET /beta/system/information`

- `listSystemLicense` (Product licensing): `GET /v1/system/license`

- `listSystemNode` (System: Nodes): `GET /v1/system/node`

- `listTags` (Tags): `GET /v1/tags`

- `listTasks` (Tasks): `GET /v1/tasks`

- `listTasksTemplates` (Tasks): `GET /v1/tasks/templates`

- `listUsageHistory` (Usage History): `GET /v1/usage-history`

- `updateApikeysEncryptionReEncrypt` (Security management: api keys principals encryption): `PUT /v1/apikeys/encryption/re-encrypt`

- `updateBlobstoresAzure` (Blob store): `PUT /v1/blobstores/azure/{name}`

- `updateBlobstoresFile` (Blob store): `PUT /v1/blobstores/file/{name}`

- `updateBlobstoresGoogle` (Blob store): `PUT /v1/blobstores/google/{name}`

- `updateBlobstoresGroup` (Blob store): `PUT /v1/blobstores/group/{name}`

- `updateBlobstoresS3` (Blob store): `PUT /v1/blobstores/s3/{name}`

- `updateCapabilities` (Capabilities): `PUT /v1/capabilities/{capabilityId}`

- `updateCleanupPolicies` (Cleanup policies): `PUT /v1/cleanup-policies/{policyName}`

- `updateConfiguration` (Instance configuration): `PUT /v1/configuration`

- `updateDataStore` (Data Store): `PUT /beta/data-store`

- `updateEmail` (Email): `PUT /v1/email`

- `updateHttp` (Manage Sonatype HTTP System Settings): `PUT /v1/http`

- `updateIq` (Manage Sonatype Repository Firewall configuration): `PUT /v1/iq`

- `updateIqAudit` (Manage Sonatype Repository Firewall configuration): `PUT /v1/iq/audit`

- `updateLifecycleBounce` (Lifecycle): `PUT /v1/lifecycle/bounce`

- `updateLifecyclePhase` (Lifecycle): `PUT /v1/lifecycle/phase`

- `updatePlan :: PUT /v1/plan` (Reconcile Plan): `PUT /v1/plan`

- `updatePlan :: PUT /v1/plan/{planId}` (Reconcile Plan): `PUT /v1/plan/{planId}`

- `updateRepositoriesAlpineGroup` (Repository Management / alpine / group): `PUT /v1/repositories/alpine/group/{repositoryName}`

- `updateRepositoriesAlpineHosted` (Repository Management / alpine / hosted): `PUT /v1/repositories/alpine/hosted/{repositoryName}`

- `updateRepositoriesAlpineProxy` (Repository Management / alpine / proxy): `PUT /v1/repositories/alpine/proxy/{repositoryName}`

- `updateRepositoriesAnsiblegalaxyGroup` (Repository Management / ansiblegalaxy / group): `PUT /v1/repositories/ansiblegalaxy/group/{repositoryName}`

- `updateRepositoriesAnsiblegalaxyHosted` (Repository Management / ansiblegalaxy / hosted): `PUT /v1/repositories/ansiblegalaxy/hosted/{repositoryName}`

- `updateRepositoriesAnsiblegalaxyProxy` (Repository Management / ansiblegalaxy / proxy): `PUT /v1/repositories/ansiblegalaxy/proxy/{repositoryName}`

- `updateRepositoriesAptHosted` (Repository Management / apt / hosted): `PUT /v1/repositories/apt/hosted/{repositoryName}`

- `updateRepositoriesAptProxy` (Repository Management / apt / proxy): `PUT /v1/repositories/apt/proxy/{repositoryName}`

- `updateRepositoriesCargoGroup` (Repository Management / cargo / group): `PUT /v1/repositories/cargo/group/{repositoryName}`

- `updateRepositoriesCargoHosted` (Repository Management / cargo / hosted): `PUT /v1/repositories/cargo/hosted/{repositoryName}`

- `updateRepositoriesCargoProxy` (Repository Management / cargo / proxy): `PUT /v1/repositories/cargo/proxy/{repositoryName}`

- `updateRepositoriesCocoapodsProxy` (Repository Management / cocoapods / proxy): `PUT /v1/repositories/cocoapods/proxy/{repositoryName}`

- `updateRepositoriesComposerGroup` (Repository Management / composer / group): `PUT /v1/repositories/composer/group/{repositoryName}`

- `updateRepositoriesComposerHosted` (Repository Management / composer / hosted): `PUT /v1/repositories/composer/hosted/{repositoryName}`

- `updateRepositoriesComposerProxy` (Repository Management / composer / proxy): `PUT /v1/repositories/composer/proxy/{repositoryName}`

- `updateRepositoriesConanGroup` (Repository Management / conan / group): `PUT /v1/repositories/conan/group/{repositoryName}`

- `updateRepositoriesConanHosted` (Repository Management / conan / hosted): `PUT /v1/repositories/conan/hosted/{repositoryName}`

- `updateRepositoriesConanProxy` (Repository Management / conan / proxy): `PUT /v1/repositories/conan/proxy/{repositoryName}`

- `updateRepositoriesCondaGroup` (Repository Management / conda / group): `PUT /v1/repositories/conda/group/{repositoryName}`

- `updateRepositoriesCondaHosted` (Repository Management / conda / hosted): `PUT /v1/repositories/conda/hosted/{repositoryName}`

- `updateRepositoriesCondaProxy` (Repository Management / conda / proxy): `PUT /v1/repositories/conda/proxy/{repositoryName}`

- `updateRepositoriesDockerGroup` (Repository Management / docker / group): `PUT /v1/repositories/docker/group/{repositoryName}`

- `updateRepositoriesDockerHosted` (Repository Management / docker / hosted): `PUT /v1/repositories/docker/hosted/{repositoryName}`

- `updateRepositoriesDockerProxy` (Repository Management / docker / proxy): `PUT /v1/repositories/docker/proxy/{repositoryName}`

- `updateRepositoriesGitlfsHosted` (Repository Management / gitlfs / hosted): `PUT /v1/repositories/gitlfs/hosted/{repositoryName}`

- `updateRepositoriesGoGroup` (Repository Management / go / group): `PUT /v1/repositories/go/group/{repositoryName}`

- `updateRepositoriesGoHosted` (Repository Management / go / hosted): `PUT /v1/repositories/go/hosted/{repositoryName}`

- `updateRepositoriesGoProxy` (Repository Management / go / proxy): `PUT /v1/repositories/go/proxy/{repositoryName}`

- `updateRepositoriesHelmGroup` (Repository Management / helm / group): `PUT /v1/repositories/helm/group/{repositoryName}`

- `updateRepositoriesHelmHosted` (Repository Management / helm / hosted): `PUT /v1/repositories/helm/hosted/{repositoryName}`

- `updateRepositoriesHelmProxy` (Repository Management / helm / proxy): `PUT /v1/repositories/helm/proxy/{repositoryName}`

- `updateRepositoriesHuggingfaceProxy` (Repository Management / huggingface / proxy): `PUT /v1/repositories/huggingface/proxy/{repositoryName}`

- `updateRepositoriesMavenGroup` (Repository Management / maven / group): `PUT /v1/repositories/maven/group/{repositoryName}`

- `updateRepositoriesMavenHosted` (Repository Management / maven / hosted): `PUT /v1/repositories/maven/hosted/{repositoryName}`

- `updateRepositoriesMavenProxy` (Repository Management / maven / proxy): `PUT /v1/repositories/maven/proxy/{repositoryName}`

- `updateRepositoriesNpmGroup` (Repository Management / npm / group): `PUT /v1/repositories/npm/group/{repositoryName}`

- `updateRepositoriesNpmHosted` (Repository Management / npm / hosted): `PUT /v1/repositories/npm/hosted/{repositoryName}`

- `updateRepositoriesNpmProxy` (Repository Management / npm / proxy): `PUT /v1/repositories/npm/proxy/{repositoryName}`

- `updateRepositoriesNugetGroup` (Repository Management / nuget / group): `PUT /v1/repositories/nuget/group/{repositoryName}`

- `updateRepositoriesNugetHosted` (Repository Management / nuget / hosted): `PUT /v1/repositories/nuget/hosted/{repositoryName}`

- `updateRepositoriesNugetProxy` (Repository Management / nuget / proxy): `PUT /v1/repositories/nuget/proxy/{repositoryName}`

- `updateRepositoriesOciGroup` (Repository Management / oci / group): `PUT /v1/repositories/oci/group/{repositoryName}`

- `updateRepositoriesOciHosted` (Repository Management / oci / hosted): `PUT /v1/repositories/oci/hosted/{repositoryName}`

- `updateRepositoriesOciProxy` (Repository Management / oci / proxy): `PUT /v1/repositories/oci/proxy/{repositoryName}`

- `updateRepositoriesP2Proxy` (Repository Management / p2 / proxy): `PUT /v1/repositories/p2/proxy/{repositoryName}`

- `updateRepositoriesPubGroup` (Repository Management / pub / group): `PUT /v1/repositories/pub/group/{repositoryName}`

- `updateRepositoriesPubHosted` (Repository Management / pub / hosted): `PUT /v1/repositories/pub/hosted/{repositoryName}`

- `updateRepositoriesPubProxy` (Repository Management / pub / proxy): `PUT /v1/repositories/pub/proxy/{repositoryName}`

- `updateRepositoriesPypiGroup` (Repository Management / pypi / group): `PUT /v1/repositories/pypi/group/{repositoryName}`

- `updateRepositoriesPypiHosted` (Repository Management / pypi / hosted): `PUT /v1/repositories/pypi/hosted/{repositoryName}`

- `updateRepositoriesPypiProxy` (Repository Management / pypi / proxy): `PUT /v1/repositories/pypi/proxy/{repositoryName}`

- `updateRepositoriesRGroup` (Repository Management / r / group): `PUT /v1/repositories/r/group/{repositoryName}`

- `updateRepositoriesRHosted` (Repository Management / r / hosted): `PUT /v1/repositories/r/hosted/{repositoryName}`

- `updateRepositoriesRProxy` (Repository Management / r / proxy): `PUT /v1/repositories/r/proxy/{repositoryName}`

- `updateRepositoriesRawGroup` (Repository Management / raw / group): `PUT /v1/repositories/raw/group/{repositoryName}`

- `updateRepositoriesRawHosted` (Repository Management / raw / hosted): `PUT /v1/repositories/raw/hosted/{repositoryName}`

- `updateRepositoriesRawProxy` (Repository Management / raw / proxy): `PUT /v1/repositories/raw/proxy/{repositoryName}`

- `updateRepositoriesRubygemsGroup` (Repository Management / rubygems / group): `PUT /v1/repositories/rubygems/group/{repositoryName}`

- `updateRepositoriesRubygemsHosted` (Repository Management / rubygems / hosted): `PUT /v1/repositories/rubygems/hosted/{repositoryName}`

- `updateRepositoriesRubygemsProxy` (Repository Management / rubygems / proxy): `PUT /v1/repositories/rubygems/proxy/{repositoryName}`

- `updateRepositoriesSwiftGroup` (Repository Management / swift / group): `PUT /v1/repositories/swift/group/{repositoryName}`

- `updateRepositoriesSwiftHosted` (Repository Management / swift / hosted): `PUT /v1/repositories/swift/hosted/{repositoryName}`

- `updateRepositoriesSwiftProxy` (Repository Management / swift / proxy): `PUT /v1/repositories/swift/proxy/{repositoryName}`

- `updateRepositoriesTerraformGroup` (Repository Management / terraform / group): `PUT /v1/repositories/terraform/group/{repositoryName}`

- `updateRepositoriesTerraformHosted` (Repository Management / terraform / hosted): `PUT /v1/repositories/terraform/hosted/{repositoryName}`

- `updateRepositoriesTerraformProxy` (Repository Management / terraform / proxy): `PUT /v1/repositories/terraform/proxy/{repositoryName}`

- `updateRepositoriesYumGroup` (Repository Management / yum / group): `PUT /v1/repositories/yum/group/{repositoryName}`

- `updateRepositoriesYumHosted` (Repository Management / yum / hosted): `PUT /v1/repositories/yum/hosted/{repositoryName}`

- `updateRepositoriesYumProxy` (Repository Management / yum / proxy): `PUT /v1/repositories/yum/proxy/{repositoryName}`

- `updateRoutingRules` (Routing rules): `PUT /v1/routing-rules/{name}`

- `updateScript` (Script): `PUT /v1/script/{name}`

- `updateSecretsEncryptionReEncrypt` (Security management: secrets encryption): `PUT /v1/secrets/encryption/re-encrypt`

- `updateSecurityAnonymous` (Security Management: Anonymous Access): `PUT /v1/security/anonymous`

- `updateSecurityAtlassianCrowd` (Security: Atlassian Crowd): `PUT /v1/security/atlassian-crowd`

- `updateSecurityContentSelectors` (Content selectors): `PUT /v1/security/content-selectors/{name}`

- `updateSecurityIpAllowlistEntries` (Security: IP Allow List): `PUT /v1/security/ip-allowlist/entries/{id}`

- `updateSecurityIpAllowlistMode` (Security: IP Allow List): `PUT /v1/security/ip-allowlist/mode`

- `updateSecurityLdap` (Security management: LDAP): `PUT /v1/security/ldap/{name}`

- `updateSecurityPrivilegesApplication` (Security management: privileges): `PUT /v1/security/privileges/application/{privilegeName}`

- `updateSecurityPrivilegesRepositoryAdmin` (Security management: privileges): `PUT /v1/security/privileges/repository-admin/{privilegeName}`

- `updateSecurityPrivilegesRepositoryContentSelector` (Security management: privileges): `PUT /v1/security/privileges/repository-content-selector/{privilegeName}`

- `updateSecurityPrivilegesRepositoryView` (Security management: privileges): `PUT /v1/security/privileges/repository-view/{privilegeName}`

- `updateSecurityPrivilegesScript` (Security management: privileges): `PUT /v1/security/privileges/script/{privilegeName}`

- `updateSecurityPrivilegesWildcard` (Security management: privileges): `PUT /v1/security/privileges/wildcard/{privilegeName}`

- `updateSecurityRealmsActive` (Security management: realms): `PUT /v1/security/realms/active`

- `updateSecurityRoles` (Security management: roles): `PUT /v1/security/roles/{id}`

- `updateSecuritySaml` (Security management: SAML): `PUT /v1/security/saml`

- `updateSecuritySamlUsers` (Security management: SAML users): `PUT /v1/security/saml/users/{userId}`

- `updateSecuritySsrfProtection` (Security Management: SSRF Protection): `PUT /v1/security/ssrf-protection`

- `updateSecurityUserTokens` (Security management: user tokens): `PUT /v1/security/user-tokens`

- `updateSecurityUsers` (Security management: users): `PUT /v1/security/users/{userId}`

- `updateSecurityUsersChangePassword` (Security management: users): `PUT /v1/security/users/{userId}/change-password`

- `updateTags` (Tags): `PUT /v1/tags/{name}`

- `updateTasks` (Tasks): `PUT /v1/tasks/{taskId}`
