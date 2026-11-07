import { CliError, type OptionDefinition } from "@eyeauras/cli-factory";

/** Declare the pinned Nexus search options; asset suffix filters apply to asset searches. */
export function searchOptions(assets: boolean): OptionDefinition[] {
  return [
    ...["repository", "name", "artifact-version", "group", "format", "q", "maven-base-version",
      ...(assets ? ["maven-extension", "maven-classifier"] : [])].map(name => ({
      flags: `--${name} <value>`,
      description: "Filter matching artifacts",
    })),
    {
      flags: "--sort <field>",
      description: "Sort by group, name, version or repository",
      parse(value) {
        if (!["group", "name", "version", "repository"].includes(value))
          throw new CliError("Sort must be group, name, version or repository.", { code: "usage", exitCode: 2 });
        return value;
      },
    },
    {
      flags: "--direction <order>",
      description: "Order sorted matches asc or desc",
      parse(value) {
        if (value !== "asc" && value !== "desc")
          throw new CliError("Direction must be asc or desc.", { code: "usage", exitCode: 2 });
        return value;
      },
    },
    {
      flags: "--prerelease <boolean>",
      description: "Filter prereleases with true or false",
      parse(value) {
        if (value !== "true" && value !== "false")
          throw new CliError("Prerelease must be true or false.", { code: "usage", exitCode: 2 });
        return value; // Nexus declares a string, including the lowercase value "false".
      },
    },
  ];
}

/** Preserve supplied Nexus query values; ordering and download selection stay server-side. */
export function searchQuery(options: Record<string, unknown>): URLSearchParams {
  if (options.direction !== undefined && options.sort === undefined)
    throw new CliError("Direction requires --sort.", { code: "usage", exitCode: 2 });
  const query = new URLSearchParams();
  for (const [key, wire] of Object.entries({
    repository: "repository", name: "name", artifactVersion: "version", group: "group",
    format: "format", q: "q", mavenBaseVersion: "maven.baseVersion",
    mavenExtension: "maven.extension", mavenClassifier: "maven.classifier",
    sort: "sort", direction: "direction", prerelease: "prerelease",
  })) if (options[key] !== undefined) query.set(wire, String(options[key]));
  return query;
}
