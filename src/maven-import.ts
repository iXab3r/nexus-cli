import { lstat } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import { basename, resolve } from "node:path";
import { CliError, type CommandContext } from "@eyeauras/cli-factory";

const usage = (message: string): never => {
  throw new CliError(message, { code: "usage", exitCode: 2 });
};
interface Asset { file: string; extension: string; classifier?: string }
const suffix = (value: string) => /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(value);

/** Collect opaque JSON descriptors without splitting local path delimiters. */
export function collectAsset(value: string, previous: unknown): string[] {
  const values = [...(Array.isArray(previous) ? previous : []), value];
  if (values.length > 16) usage("POM import requires 1–16 companion assets.");
  return values;
}

/** Preserve the original POM; Nexus alone interprets its coordinates. */
export async function pomImport(options: Record<string, unknown>, c: CommandContext): Promise<FormData> {
  if (["file", "group", "artifact", "artifactVersion", "extension", "generatePom"].some(key => options[key] !== undefined))
    usage("POM import and generated-JAR options are mutually exclusive.");
  if (typeof options.pom !== "string" || !options.pom.trim()) usage("POM file must be nonempty.");
  if (!Array.isArray(options.asset) || options.asset.length < 1 || options.asset.length > 16)
    usage("POM import requires 1–16 companion assets.");
  const assets: Asset[] = [{file: options.pom as string, extension: "pom"}];
  const tuples = new Set(["pom:"]);
  for (const raw of options.asset as string[]) {
    let value: any;
    try { value = JSON.parse(raw); } catch { usage("Asset must be a JSON object with file and extension."); }
    if (!value || Array.isArray(value) || typeof value !== "object" ||
        Object.keys(value).some(key => !["file", "extension", "classifier"].includes(key)) ||
        typeof value.file !== "string" || !value.file.trim() ||
        typeof value.extension !== "string" || !suffix(value.extension) ||
        (value.classifier !== undefined && (typeof value.classifier !== "string" || (value.classifier !== "" && !suffix(value.classifier)))))
      usage("Asset requires file, a safe extension and an optional safe classifier.");
    const tuple = `${value.extension}:${value.classifier ?? ""}`;
    if (tuples.has(tuple)) usage("Asset extension/classifier pairs must be unique; unclassified pom is reserved.");
    tuples.add(tuple);
    assets.push(value);
  }
  const form = new FormData();
  form.set("maven2.generate-pom", "false");
  for (const [index, asset] of assets.entries()) {
    c.signal?.throwIfAborted();
    const path = resolve(asset.file);
    let blob: Blob;
    try {
      if (!(await lstat(path)).isFile()) usage("Upload requires a regular file.");
      blob = await openAsBlob(path);
    } catch (cause) {
      if (cause instanceof CliError) throw cause;
      usage("Upload requires an accessible regular file.");
    }
    c.signal?.throwIfAborted();
    const field = `maven2.asset${index + 1}`;
    form.set(field, blob!, basename(path));
    form.set(field + ".extension", asset.extension);
    if (asset.classifier) form.set(field + ".classifier", asset.classifier);
  }
  return form;
}
