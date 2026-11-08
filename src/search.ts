import { CliError, integerParser, jsonParser, type OptionDefinition } from "@eyeauras/cli-factory";

/** Scalar string selectors from the pinned Nexus 3.96.3-01 search contract. */
const nativeStrings = new Set([
  "q", "repository", "repositoryName", "format",
  "group", "name", "version", "prerelease",
  "last_updated", "lastBlobUpdated", "md5", "sha1",
  "sha256", "sha512", "ansible-galaxy.namespace", "ansible-galaxy.name",
  "ansible-galaxy.version", "composer.vendor", "composer.package", "composer.version",
  "composer.description", "composer.keywords", "conan.baseVersion", "conan.channel",
  "conan.revision", "conan.packageId", "conan.packageRevision", "docker.imageName",
  "docker.imageTag", "docker.layerId", "docker.contentDigest", "docker.os",
  "docker.architecture", "docker.labels", "docker.author", "maven.groupId",
  "maven.artifactId", "maven.baseVersion", "maven.extension", "maven.classifier",
  "gavec", "npm.scope", "npm.author", "npm.description",
  "npm.keywords", "npm.license", "npm.tagged_is", "npm.tagged_not",
  "nuget.id", "nuget.tags", "nuget.title", "nuget.authors",
  "nuget.description", "nuget.summary", "nuget.is_prerelease", "oci.imageName",
  "oci.imageTag", "oci.contentDigest", "p2.pluginName", "pub.asset_kind",
  "pypi.classifiers", "pypi.description", "pypi.keywords", "pypi.summary",
  "raw.name", "rubygems.description", "rubygems.platform", "rubygems.summary",
  "swift.scope", "swift.asset_kind", "tag", "terraform.provider",
  "terraform.namespace", "terraform.name", "yum.architecture", "yum.name",
]);
interface NativeFilter { name: string; value: string }
const parseFilter = jsonParser("Filter must be JSON with name and value.");
function usage(message: string): never { throw new CliError(message, { code: "usage", exitCode: 2 }); }
/** Detect duplicates before Commander replaces an earlier scalar query value. */
export function singleSearchValue(value: string, previous: unknown): string {
  if (previous !== undefined) usage("Each Nexus query parameter must have one value.");
  return value;
}
const parseTimeout = integerParser({
  min: -2147483648, max: 2147483647, signed: true, errorMessage: "Timeout must be a signed int32 decimal integer.",
});
function collectFilter(value: string, previous: unknown): NativeFilter[] {
  const r: any = parseFilter(value);
  if (!r || typeof r !== "object" || Array.isArray(r) || Object.keys(r).some(k => k !== "name" && k !== "value") ||
    typeof r.name !== "string" || !nativeStrings.has(r.name) || typeof r.value !== "string")
    usage("Filter requires a supported Nexus string parameter name and value.");
  const filters: NativeFilter[] = Array.isArray(previous) ? previous : [];
  if (filters.some(f => f.name === r.name)) usage("Each Nexus query parameter must have one value.");
  return [...filters, { name: r.name, value: r.value }];
}

/** Declare native selectors and the existing convenience flags. */
export function searchOptions(assets: boolean): OptionDefinition[] {
  return [
    { flags: "--filter <json>", description: "Filter by a Nexus parameter (repeatable)", parse: collectFilter },
    { flags: "--timeout <seconds>", description: "Pass the server search timeout",
      parse: (value, previous) => parseTimeout(singleSearchValue(value, previous)) },
    ...["repository", "name", "artifact-version", "group", "format", "q", "maven-base-version",
      ...(assets ? ["maven-extension", "maven-classifier"] : [])].map(name => ({
      flags: `--${name} <value>`,
      description: "Filter matching artifacts",
      parse: singleSearchValue,
    })),
    {
      flags: "--sort <field>",
      description: "Sort by group, name, version or repository",
      parse(value, previous) {
        singleSearchValue(value, previous);
        if (!["group", "name", "version", "repository"].includes(value))
          throw new CliError("Sort must be group, name, version or repository.", { code: "usage", exitCode: 2 });
        return value;
      },
    },
    {
      flags: "--direction <order>",
      description: "Order sorted matches asc or desc",
      parse(value, previous) {
        singleSearchValue(value, previous);
        if (value !== "asc" && value !== "desc")
          throw new CliError("Direction must be asc or desc.", { code: "usage", exitCode: 2 });
        return value;
      },
    },
    {
      flags: "--prerelease <boolean>",
      description: "Filter prereleases with true or false",
      parse(value, previous) {
        singleSearchValue(value, previous);
        if (value !== "true" && value !== "false")
          throw new CliError("Prerelease must be true or false.", { code: "usage", exitCode: 2 });
        return value; // Nexus declares a string, including the lowercase value "false".
      },
    },
  ];
}

/** Preserve supplied Nexus query values; ordering and download selection stay server-side. */
export function searchQuery(options: Record<string, unknown>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, wire] of Object.entries({
    repository: "repository", name: "name", artifactVersion: "version", group: "group",
    format: "format", q: "q", mavenBaseVersion: "maven.baseVersion",
    mavenExtension: "maven.extension", mavenClassifier: "maven.classifier",
    sort: "sort", direction: "direction", prerelease: "prerelease", timeout: "timeout",
  })) if (options[key] !== undefined) query.set(wire, String(options[key]));
  for (const filter of (options.filter as NativeFilter[] | undefined) ?? []) {
    if (query.has(filter.name)) usage("Each Nexus query parameter must have one value.");
    query.set(filter.name, filter.value);
  }
  return query;
}
