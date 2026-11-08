import { CliError, command, Permission, listView, recordView, tableView, type CommandContext } from "@eyeauras/cli-factory";
import { pathSegment } from "./client.js";
import { document } from "./mutations.js";

interface BlobStore { name: string; type: string }
interface QuotaStatus { blobStoreName: string; isViolation: boolean; message: string }
interface UploadField { name: string; optional: boolean; type?: string }
interface UploadSpecification {
  format: string;
  multipleUpload: boolean;
  componentFields: UploadField[];
  assetFields: UploadField[];
}
function invalid(): never {
  throw new CliError("Invalid Nexus discovery response or CLI resource limit exceeded.", {code: "nexus.decodeFailed"});
}
/** Output labels have a 256-byte UTF-8 budget and cannot contain terminal controls. */
function label(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 256 || /[\x00-\x1f\x7f-\x9f]/.test(value)) invalid();
  return value;
}
/** Admit one whole discovery array; the existing document reader caps decoded bytes at 4 MiB. */
async function discovery(c: CommandContext, path: string): Promise<unknown[]> {
  const value = await document(c, path);
  if (!Array.isArray(value) || value.length > 1000) invalid();
  return value;
}
function blobStore(value: any): BlobStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return {name: label(value.name), type: label(value.type)};
}
/** Quota messages are service data; only the human view escapes terminal controls. */
function quotaText(value: string): string {
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}
async function quotaStatus(c: CommandContext, name: string): Promise<QuotaStatus> {
  const r = await document(c, "blobstores/" + pathSegment(name) + "/quota-status");
  if (!r || typeof r !== "object" || Array.isArray(r) ||
    typeof r.blobStoreName !== "string" || r.blobStoreName.length === 0 ||
    typeof r.isViolation !== "boolean" || typeof r.message !== "string" || r.message.length === 0) invalid();
  const result = { blobStoreName: r.blobStoreName as string, isViolation: r.isViolation as boolean, message: r.message as string };
  if (result.isViolation) throw new CliError("Blob store soft quota is violated.", {
    code: "nexus.blobstore.quotaViolation", result,
  });
  return result;
}
/** Project only upload selectors and requiredness; arbitrary service attributes stay private. */
function uploadSpecification(value: any): UploadSpecification {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.multipleUpload !== "boolean") invalid();
  function fields(raw: unknown): UploadField[] {
    if (!Array.isArray(raw) || raw.length > 64) invalid();
    return raw.map(field => {
      if (!field || typeof field !== "object" || Array.isArray(field) || typeof field.optional !== "boolean") invalid();
      return {name: label(field.name), optional: field.optional, ...(field.type === undefined ? {} : {type: label(field.type)})};
    });
  }
  return {format: label(value.format), multipleUpload: value.multipleUpload,
    componentFields: fields(value.componentFields), assetFields: fields(value.assetFields)};
}
function fieldText(field: UploadField): string {
  return `${field.name}: ${field.optional ? "optional" : "required"}${field.type === undefined ? "" : ` (${field.type})`}`;
}
/** Discover projected blob store labels under the local ReadOnly gate. */
export const blobstoresCommand = command("blobstores", "Inspect blob stores", [
  command("quota-status <name>", "Check a blob store soft quota", ({args}, c) => quotaStatus(c, String(args.name)), {
    permission: Permission.ReadOnly,
    view: recordView<QuotaStatus>({fields: [
      {label: "Blob store", value: r => quotaText(r.blobStoreName)},
      {label: "Quota violated", value: r => r.isViolation},
      {label: "Message", value: r => quotaText(r.message)},
    ]}),
  }),
  command("list", "List blob store names and types", async (_input, c) => (await discovery(c, "blobstores")).map(blobStore), {
    permission: Permission.ReadOnly,
    view: tableView<BlobStore>({columns: [
      {header: "Name", value: r => r.name}, {header: "Type", value: r => r.type},
    ], empty: "No blob stores."}),
  }),
]);
/** Discover projected upload field scopes without creating an upload preflight. */
export const formatsCommand = command("formats", "Inspect format requirements", [
  command("upload-specs", "Inspect upload requirements", [
    command("list", "List format upload specifications", async (_input, c) => (await discovery(c, "formats/upload-specs")).map(uploadSpecification), {
      permission: Permission.ReadOnly,
      view: listView<string, readonly UploadSpecification[]>({
        items: specs => specs.flatMap(r => [
          `Format: ${r.format}`, `Multiple upload: ${r.multipleUpload}`,
          "Component fields", ...(r.componentFields.length ? r.componentFields.map(fieldText) : ["none"]),
          "Asset fields", ...(r.assetFields.length ? r.assetFields.map(fieldText) : ["none"]), "",
        ]),
        line: value => value,
        empty: "No upload specifications.",
      }),
    }),
    command("get <format>", "Inspect one upload specification", async ({args}, c) => uploadSpecification(
      await document(c, "formats/" + pathSegment(String(args.format)) + "/upload-specs")), {
      permission: Permission.ReadOnly,
      view: recordView<UploadSpecification>({fields: [
        {label: "Format", value: r => r.format}, {label: "Multiple upload", value: r => r.multipleUpload},
      ], sections: [
        {title: () => "Component fields", lines: r => r.componentFields.map(fieldText)},
        {title: () => "Asset fields", lines: r => r.assetFields.map(fieldText)},
      ]}),
    }),
  ]),
]);
