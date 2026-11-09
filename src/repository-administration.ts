import { validateDto, dtoRedactions } from "./nexus-dto.js";
import { CliError, command, Permission, recordView } from "@eyeauras/cli-factory";
import { pathSegment } from "./client.js";
import { document, mutate } from "./mutations.js";
import { inputDocument } from "./administration-input.js";
import { repositorySchemas } from "./repository-schemas.js";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const view = recordView<any>({ fields: [
  { label: "Name", value: r => r.name }, { label: "Online", value: r => r.online },
  { label: "Blob store", value: r => r.storage?.blobStoreName },
  { label: "Members", value: r => r.group?.memberNames.join(", ") },
  { label: "Acknowledged", value: r => r.acknowledged },
] });
export function repositoryFormats(type: string) {
  return ["cargo", "nuget", "npm", "docker"].map(format => {
    const schema = repositorySchemas[cap(format) + cap(type) + "RepositoryApiRequest"];
    // 3.97 NugetApiRepositoryAdapter supplies HostedStorageAttributes for proxy
    // observations, although its mutation DTO accepts only StorageAttributes.
    const readSchema = format === "nuget" && type === "proxy" ? {
      ...schema, properties: { ...schema.properties, storage: {
        ...repositorySchemas.StorageAttributes,
        properties: { ...repositorySchemas.StorageAttributes.properties,
          writePolicy: repositorySchemas.HostedStorageAttributes.properties.writePolicy },
      } },
    } : schema;
    const path = `repositories/${format}/${type}`;
    return command(format, `Manage ${format} ${type} repositories`, [
      command("get <name>", "Inspect repository settings", async ({ args }, c) => {
        const response = await document(c, path + "/" + pathSegment(String(args.name)));
        // These response-only identity fields do not belong in PUT input.
        const { format: actualFormat, type: actualType, url, ...settings } = response ?? {};
        if ((actualFormat !== undefined && actualFormat !== format) || (actualType !== undefined && actualType !== type) || settings.name !== args.name) throw new CliError("Nexus repository identity is invalid.", { code: "nexus.decodeFailed" });
        const result = validateDto(settings, readSchema, repositorySchemas, true);
        return { ...result, ...(actualFormat === undefined ? {} : { format: actualFormat }), ...(actualType === undefined ? {} : { type: actualType }), ...(url === undefined ? {} : { url: safeRepositoryUrl(url) }) };
      }, { permission: Permission.ReadOnly, view }),
      ...["create", "update"].map(action => command(action === "create" ? "create" : "update <name>", action === "create" ? "Create a repository" : "Replace repository settings", async ({ args, options }, c) => {
        const body = validateDto(await inputDocument(c, options.inputFile), schema, repositorySchemas, false);
        if (action === "update" && body.name !== args.name) throw new CliError("Input name must match the repository name.", { code: "usage.invalid", exitCode: 2 });
        await mutate(c, path + (action === "update" ? "/" + pathSegment(String(args.name)) : ""), action === "create" ? "POST" : "PUT", JSON.stringify(body), action === "create" ? 201 : 204, { operation: "Configure Nexus repository", redactions: dtoRedactions(body) });
        return { name: body.name, acknowledged: true };
      }, { permission: Permission.Update, options: [{ flags: "--input-file <json>", description: "Read repository settings from a file", required: true }], view })),
    ]);
  });
}

function safeRepositoryUrl(value: unknown): string | null {
  try { const u = new URL(String(value)); u.username = ""; u.password = ""; u.search = ""; u.hash = ""; return u.href; } catch { return null; }
}
