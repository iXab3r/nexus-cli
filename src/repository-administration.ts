import { CliError, command, Permission, recordView } from "@eyeauras/cli-factory";
import { pathSegment } from "./client.js";
import { document, mutate } from "./mutations.js";
import { inputDocument } from "./administration-input.js";
import { repositorySchemas } from "./repository-schemas.js";

function invalid(read: boolean): never {
  throw new CliError(read ? "Nexus repository configuration is invalid." : "Input must match the Nexus repository configuration schema.", { code: read ? "nexus.decodeFailed" : "usage.invalid", exitCode: read ? 1 : 2 });
}
/** Nexus request DTO validation; reject unrepresentable settings before writes. */
function validate(value: any, schema: any, read: boolean, required = true): any {
  if (schema.$ref) schema = repositorySchemas[schema.$ref.split("/").pop()!];
  if (value === null && !required) return null;
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid(read);
    const out: Record<string, unknown> = {};
    for (const key of schema.required ?? []) if (!(key in value)) invalid(read);
    for (const [key, item] of Object.entries(value)) {
      const field = schema.properties?.[key];
      if (!field) invalid(read);
      // Server responses may contain write-only masks; never expose these.
      if (read && field.writeOnly) continue;
      out[key] = read && /url$/i.test(key) && typeof item === "string" ? safeUrl(item) : validate(item, field, read, schema.required?.includes(key) ?? false);
    }
    return out;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0)) invalid(read);
    return value.map(v => validate(v, schema.items, read));
  }
  if (schema.type === "integer") {
    if ((schema.format === "int32" && (value < -2147483648 || value > 2147483647)) || !Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) invalid(read);
  } else if (typeof value !== schema.type) invalid(read);
  if (schema.enum && !schema.enum.includes(value)) invalid(read);
  if (typeof value === "string" && (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity) || (schema.pattern && !new RegExp(schema.pattern).test(value)))) invalid(read);
  return value;
}
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
    const path = `repositories/${format}/${type}`;
    return command(format, `Manage ${format} ${type} repositories`, [
      command("get <name>", "Inspect repository settings", async ({ args }, c) => {
        const response = await document(c, path + "/" + pathSegment(String(args.name)));
        // These response-only identity fields do not belong in PUT input.
        const { format: actualFormat, type: actualType, url, ...settings } = response ?? {};
        if ((actualFormat !== undefined && actualFormat !== format) || (actualType !== undefined && actualType !== type) || settings.name !== args.name) invalid(true);
        const result = validate(settings, schema, true);
        return { ...result, ...(actualFormat === undefined ? {} : { format: actualFormat }), ...(actualType === undefined ? {} : { type: actualType }), ...(url === undefined ? {} : { url: safeUrl(url) }) };
      }, { permission: Permission.ReadOnly, view }),
      ...["create", "update"].map(action => command(action === "create" ? "create" : "update <name>", action === "create" ? "Create a repository" : "Replace repository settings", async ({ args, options }, c) => {
        const body = validate(await inputDocument(c, options.inputFile), schema, false);
        if (action === "update" && body.name !== args.name) throw new CliError("Input name must match the repository name.", { code: "usage.invalid", exitCode: 2 });
        await mutate(c, path + (action === "update" ? "/" + pathSegment(String(args.name)) : ""), action === "create" ? "POST" : "PUT", JSON.stringify(body), action === "create" ? 201 : 204, { operation: "Configure Nexus repository", redactions: strings(body) });
        return { name: body.name, acknowledged: true };
      }, { permission: Permission.Update, options: [{ flags: "--input-file <json>", description: "Read repository settings from a file", required: true }], view })),
    ]);
  });
}
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); u.username = ""; u.password = ""; u.search = ""; u.hash = ""; return u.href; } catch { return null; }
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
}
