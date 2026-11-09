import { CliError } from "@eyeauras/cli-factory";
function invalid(read: boolean): never {
  throw new CliError(read ? "Nexus configuration is invalid." : "Input must match the Nexus configuration schema.", { code: read ? "nexus.decodeFailed" : "usage.invalid", exitCode: read ? 1 : 2 });
}
/** Nexus request DTO validation; reject unrepresentable settings before writes. */
export function validateDto(value: any, schema: any, schemas: Record<string, any>, read: boolean, required = true): any {
  if (schema.$ref) schema = schemas[schema.$ref.split("/").pop()!];
  if (value === null && (!required || schema.nullable)) return null;
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid(read);
    const out: Record<string, unknown> = {};
    for (const key of schema.required ?? []) if (!(key in value)) invalid(read);
    for (const [key, item] of Object.entries(value)) {
      const field = schema.properties?.[key];
      if (!field) invalid(read);
      // Server responses may contain write-only masks; never expose these.
      if (read && field.writeOnly) continue;
      const checked = validateDto(item, field, schemas, read, schema.required?.includes(key) ?? false);
      out[key] = read && /url$/i.test(key) && typeof checked === "string" ? safeUrl(checked) : checked;
    }
    return out;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0)) invalid(read);
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) invalid(read);
    return value.map(v => validateDto(v, schema.items, schemas, read));
  }
  if (schema.type === "integer") {
    if ((schema.format === "int32" && (value < -2147483648 || value > 2147483647)) || !Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) invalid(read);
  } else if (typeof value !== schema.type) invalid(read);
  if (schema.enum && !schema.enum.includes(value)) invalid(read);
  if (typeof value === "string" && (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity) || (schema.pattern && !new RegExp(schema.pattern).test(value)))) invalid(read);
  return value;
}
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); u.username = ""; u.password = ""; u.search = ""; u.hash = ""; return u.href; } catch { return null; }
}

export function dtoRedactions(value: unknown): string[] {
  if (typeof value === "string") {
    const redactions = [value];
    try {
      const url = new URL(value);
      for (const part of [url.username, url.password, ...url.searchParams.values(), url.hash.slice(1)]) {
        if (!part) continue;
        redactions.push(part);
        try { redactions.push(decodeURIComponent(part)); } catch { /* Preserve encoded spelling. */ }
      }
    } catch { /* Non-URL DTO fields remain literal redactions. */ }
    return redactions;
  }
  return value && typeof value === "object" ? Object.values(value).flatMap(dtoRedactions) : [];
}
