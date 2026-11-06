import { readFileSync } from "node:fs";
import type { CliDefinition } from "@eyeauras/cli-factory";

const metadata = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };

/** Declare the standalone shell; Nexus commands arrive with their story tests. */
export function createDefinition(): CliDefinition {
  return {
    name: "nexus-cli",
    description: "Explore Nexus CLI help",
    version: metadata.version,
    commands: [],
  };
}
