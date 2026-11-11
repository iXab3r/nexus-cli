import { CliError, command, Permission, recordView, tableView, type CommandContext } from "@eyeauras/cli-factory";
import { pathSegment } from "./client.js";
import { document, mutate } from "./mutations.js";
import { inputDocument } from "./administration-input.js";
import { validateDto, dtoRedactions } from "./nexus-dto.js";
import { securitySchemas } from "./security-schemas.js";
import { nugetKeyCommand } from "./nuget-key.js";
const record = recordView<any>({ fields: [
  ["User", "userId"], ["ID", "id"], ["Name", "name"], ["Type", "type"], ["State", "state"],
  ["Enabled", "enabled"], ["Active", "active"], ["Role", "role"], ["Capability", "capabilityId"],
  ["Roles", "roles"], ["Privileges", "privileges"], ["Actions", "actions"], ["Format", "format"],
  ["Repository", "repository"], ["Pattern", "pattern"], ["Domain", "domain"], ["Selector", "contentSelector"],
  ["Expression", "expression"], ["Realm", "realmName"], ["Acknowledged", "acknowledged"],
].map(([label, key]) => ({ label, value: r => Array.isArray(r[key]) ? r[key].join(", ") : r[key] })) });
const table = tableView<any>({ columns: ["userId", "id", "name", "type", "status"].map(k => ({ header: k, value: r => r[k] })), empty: "No records." });
const usage = (message: string): never => { throw new CliError(message, { code: "usage.invalid", exitCode: 2 }); };
const bad = (): never => { throw new CliError("Nexus security response is invalid.", { code: "nexus.decodeFailed" }); };
const dto = (data: unknown, name: string, read = false) => validateDto(data, securitySchemas[name], securitySchemas, read);
const inputOption = [{ flags: "--input-file <json>", description: "Read settings from a JSON file", required: true }];
function read(name: string, path: string, schema: string, list = false) {
  return command(name, list ? "List security records" : "Inspect security settings", async ({ args, options }, c) => {
    const route = path + (args.id === undefined ? "" : "/" + pathSegment(String(args.id))) + (options.userId === undefined ? "" : "?" + new URLSearchParams({ userId: String(options.userId) }));
    const value = await document(c, route);
    const decode = (v: unknown) => schema === "privilege" ? privilege(v) : dto(v, schema, true);
    if (list) { if (!Array.isArray(value)) bad(); return value.map(decode); }
    const result = decode(value);
    if (args.id !== undefined && (result.id ?? result.name) !== args.id) bad();
    return result;
  }, { permission: Permission.ReadOnly, view: list ? table : record, ...(path === "security/users" ? { options: [{ flags: "--user-id <id>", description: "Search for a user ID" }] } : {}) });
}
function write(name: string, path: string, schema: string, method: "POST" | "PUT", status: number, identity?: string) {
  return command(name, method === "POST" ? "Create a security record" : "Replace security settings", async ({ args, options }, c) => {
    const body = dto(await inputDocument(c, options.inputFile, schema === "ApiCreateUser"), schema);
    if (args.id !== undefined && identity && body[identity] !== args.id) usage("Input identity must match the requested record.");
    await mutate(c, path + (args.id === undefined ? "" : "/" + pathSegment(String(args.id))), method, JSON.stringify(body), status, { operation: "Configure Nexus security", redactions: dtoRedactions(body) });
    return { ...(identity ? { [identity]: body[identity] } : {}), acknowledged: true };
  }, { permission: Permission.Update, options: inputOption, view: record });
}
function remove(path: string) {
  return command("delete <id>", "Delete one confirmed security record", async ({ args, options }, c) => {
    if (options.confirmId !== args.id) usage("Confirmation must exactly match the resource ID.");
    await mutate(c, path + "/" + pathSegment(String(args.id)), "DELETE");
    return { id: args.id, acknowledged: true };
  }, { permission: Permission.Update, options: [{ flags: "--confirm-id <id>", description: "Confirm the exact record ID", required: true }], view: record });
}
function privilege(value: any) {
  const schemas: Record<string, string> = { application: "ApiPrivilegeApplication", wildcard: "ApiPrivilegeWildcard", "repository-admin": "ApiPrivilegeRepositoryAdmin", "repository-view": "ApiPrivilegeRepositoryView", "repository-content-selector": "ApiPrivilegeRepositoryContentSelector", script: "ApiPrivilegeScript" };
  if (!value || typeof value.type !== "string" || !Object.hasOwn(schemas, value.type)) bad();
  const schema = securitySchemas[schemas[value.type]];
  // Nexus built-in privilege names contain wildcards although create-name validation forbids them.
  return validateDto(value, { ...schema, properties: { ...schema.properties, name: { type: "string", minLength: 1 } } }, securitySchemas, true);
}
async function realms(c: CommandContext): Promise<string[]> {
  const v = await document(c, "security/realms/active");
  if (!Array.isArray(v) || !v.every(x => typeof x === "string")) bad(); return v;
}
async function defaultRole(c: CommandContext) {
  const types = await document(c, "capabilities/types");
  if (!Array.isArray(types) || !types.every(t => t && typeof t.id === "string")) bad();
  const capabilities = await document(c, "capabilities");
  if (!Array.isArray(capabilities) || !capabilities.every(v => v && typeof v.id === "string" && typeof v.type === "string")) bad();
  const matches = capabilities.filter((v: any) => v.type === "defaultrole");
  if (matches.length > 1) throw new CliError("Several Default Role capabilities exist; reconcile them before changing settings.", { code: "nexus.defaultRole.ambiguous" });
  const activeRealms = await realms(c);
  const cap = matches[0];
  if (cap && (typeof cap.enabled !== "boolean" || typeof cap.active !== "boolean" || typeof cap.properties?.role !== "string")) bad();
  const supported = types.some((t: any) => t.id === "defaultrole");
  const realmActive = activeRealms.includes("DefaultRole");
  return { cap, observation: { state: !supported ? "unsupported" : !cap ? "absent" : !cap.enabled ? "disabled" : cap.active && realmActive ? "active" : "configured", enabled: cap?.enabled ?? false, active: !!cap?.enabled && !!cap?.active && realmActive, role: cap?.properties.role ?? null, capabilityId: cap?.id ?? null, realmActive, activeRealms } };
}
export const securityCommand = command("security", "Manage Nexus security", [
  nugetKeyCommand,
  command("anonymous", "Manage anonymous access", [read("get", "security/anonymous", "AnonymousAccessSettingsXO"), write("set", "security/anonymous", "AnonymousAccessSettingsXO", "PUT", 200)]),
  command("realms", "Manage ordered authentication realms", [
    read("available", "security/realms/available", "RealmApiXO", true),
    command("active", "List active authentication realms", (_i, c) => realms(c), { permission: Permission.ReadOnly, view: tableView<string>({ columns: [{ header: "Realm", value: r => r }] }) }),
    command("set-active", "Replace the ordered realm list", async ({ options }, c) => {
      const body = await inputDocument(c, options.inputFile);
      if (!Array.isArray(body) || !body.every(v => typeof v === "string")) usage("Supply an ordered JSON array of realm IDs.");
      await mutate(c, "security/realms/active", "PUT", JSON.stringify(body), 204, { operation: "Configure Nexus realms" }); return { acknowledged: true };
    }, { permission: Permission.Update, options: inputOption, view: record }),
  ]),
  command("default-role", "Manage the authenticated default role", [
    command("get", "Inspect the effective Default Role", async (_i, c) => (await defaultRole(c)).observation, { permission: Permission.ReadOnly, view: record }),
    command("set", "Configure the Default Role capability", async ({ options }, c) => {
      const body: any = await inputDocument(c, options.inputFile);
      if (!body || typeof body.enabled !== "boolean" || typeof body.role !== "string" || !body.role || Object.keys(body).some(k => !["enabled", "role"].includes(k))) usage("Supply enabled and role in the input file.");
      const { cap, observation } = await defaultRole(c);
      if (observation.state === "unsupported") throw new CliError("Default Role capability is unavailable on this Nexus installation.", { code: "nexus.defaultRole.unsupported" });
      const request = cap ? { ...cap, enabled: body.enabled, properties: { ...cap.properties, role: body.role } } : { type: "defaultrole", enabled: body.enabled, properties: { role: body.role } };
      await mutate(c, "capabilities" + (cap ? "/" + pathSegment(cap.id) : ""), cap ? "PUT" : "POST", JSON.stringify(request), cap ? 204 : 200, { operation: "Configure Default Role", redactions: dtoRedactions(request) });
      return { capabilityId: cap?.id ?? null, acknowledged: true };
    }, { permission: Permission.Update, options: inputOption, view: record }),
  ]),
  command("users", "Manage Nexus users", [
    read("list", "security/users", "ApiUser", true), write("create", "security/users", "ApiCreateUser", "POST", 200, "userId"), write("update <id>", "security/users", "ApiUser", "PUT", 204, "userId"), remove("security/users"),
    command("change-password <id>", "Replace one user's password", async ({ args, options }, c) => {
      const body: any = await inputDocument(c, options.credentialsFile, true);
      if (!body || typeof body.password !== "string" || !body.password || Object.keys(body).join() !== "password") usage("Supply a password JSON record.");
      await mutate(c, "security/users/" + pathSegment(String(args.id)) + "/change-password", "PUT", body.password, 204, { operation: "Change Nexus password", redactions: [body.password], contentType: "text/plain" });
      return { userId: args.id, acknowledged: true };
    }, { permission: Permission.Update, options: [{ flags: "--credentials-file <json>", description: "Read a protected password record", required: true }], view: record }),
  ]),
  command("roles", "Manage direct and inherited roles", [read("list", "security/roles", "RoleXOResponse", true), read("get <id>", "security/roles", "RoleXOResponse"), write("create", "security/roles", "RoleXORequest", "POST", 200, "id"), write("update <id>", "security/roles", "RoleXORequest", "PUT", 204, "id"), remove("security/roles")]),
  command("privileges", "Manage complete privilege definitions", [read("list", "security/privileges", "privilege", true), read("get <id>", "security/privileges", "privilege"), remove("security/privileges"), ...["repository-view", "repository-content-selector"].map(type => {
    const schema = type === "repository-view" ? "ApiPrivilegeRepositoryViewRequest" : "ApiPrivilegeRepositoryContentSelectorRequest";
    return command(type, "Manage repository privileges", [write("create", "security/privileges/" + type, schema, "POST", 201, "name"), write("update <id>", "security/privileges/" + type, schema, "PUT", 204, "name")]);
  })]),
  command("content-selectors", "Manage selected content expressions", [read("list", "security/content-selectors", "ContentSelectorApiResponse", true), read("get <id>", "security/content-selectors", "ContentSelectorApiResponse"), write("create", "security/content-selectors", "ContentSelectorApiCreateRequest", "POST", 204, "name"), write("update <id>", "security/content-selectors", "ContentSelectorApiUpdateRequest", "PUT", 204), remove("security/content-selectors")]),
]);
