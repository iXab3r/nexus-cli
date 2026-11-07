import { CliError, command, Permission, recordView, tableView, type CommandContext } from "@eyeauras/cli-factory";
import { pathSegment } from "./client.js";
import { document } from "./mutations.js";

interface BlobStore { name: string; type: string }
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
      view: tableView<UploadSpecification>({columns: [
        {header: "Format", value: r => r.format},
        {header: "Multiple upload", value: r => r.multipleUpload},
        {header: "Component fields", value: r => r.componentFields.map(fieldText).join(", ") || "none"},
        {header: "Asset fields", value: r => r.assetFields.map(fieldText).join(", ") || "none"},
      ], empty: "No upload specifications."}),
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
