import { operationContext, readContext, readResource, resourceRedactions, statusMessage } from "./diagnostics.js";
import { lstat } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import { basename, resolve } from "node:path";
import {
  CliError,
  HttpError,
  command,
  Permission,
  recordView,
  readResponseBody,
  diagnosticCause,
  fetchWithRedirects,
  type CommandContext,
} from "@eyeauras/cli-factory";
import { collectAsset, pomImport } from "./maven-import.js";
import { authorization, checked, pathSegment } from "./client.js";
const usage = (message: string): never => {
  throw new CliError(message, { code: "usage", exitCode: 2 });
};
/** Mutate once; a failed transport cannot establish whether Nexus committed. */
export async function mutate(
  c: CommandContext,
  path: string,
  method: string,
  body?: FormData | string,
  expectedStatus = 204,
  diagnostic: { operation: string; repository?: string; upload?: "raw" | "maven"; redactions?: string[] } = { operation: "Mutate Nexus metadata" },
) {
  const raw =
    c.profile.values.authMode === "anonymous"
      ? undefined
      : await c.secrets.require("credentials");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (raw) headers.Authorization = authorization(raw);
  if (typeof body === "string") headers["Content-Type"] = "application/json";
  const url = String(c.profile.values.url).replace(/\/$/, "") + "/service/rest/v1/" + path;
  let response: Response;
  try {
    response = await fetchWithRedirects(
      c.fetch,
      url,
      { method, headers, body, signal: c.signal },
    );
  } catch (cause) {
    throw new CliError(
      operationContext(diagnostic.operation, diagnostic.repository) + ": Nexus mutation outcome is unknown. Remote changes may have occurred.",
      {
        code: "nexus.mutation.outcomeUnknown",
        cause: diagnosticCause(
          cause,
          [...(diagnostic.redactions ?? []), ...resourceRedactions(url, readResource(path), diagnostic.repository), ...(raw ? [raw, JSON.parse(raw).password, headers.Authorization!] : [])],
        ),
      },
    );
  }
  // Cancellation can await an unread cloned stream; acknowledgment needs only status.
  void response.body?.cancel().catch(() => undefined);
  if (response.status !== expectedStatus)
    throw new HttpError(
      response.status,
      statusMessage(response.status, operationContext(diagnostic.operation, diagnostic.repository), diagnostic.upload) + " Partial changes may exist.",
    );
}
/** Decode one bounded service document without echoing response bodies. */
export async function document(c: CommandContext, path: string): Promise<any> {
  const response = await checked(c, path);
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readResponseBody(response, {
          maxBytes: 4194304,
          signal: c.signal,
        }),
      ),
    );
  } catch (cause) {
    throw new CliError(readContext(path) + ": could not decode Nexus metadata.", {
      code: "nexus.decodeFailed",
      cause: diagnosticCause(
        cause,
        resourceRedactions(String(c.profile.values.url).replace(/\/$/, "") + "/service/rest/v1/" + path, response.url, readResource(path)),
        "Invalid or incomplete Nexus response.",
      ),
    });
  }
}
const view = recordView<any>({
  fields: ["repository", "id", "observedAssetCount", "acknowledged"].map(
    (k) => ({ label: k, value: (r) => r[k] }),
  ),
});
export function deleteCommand(kind: string) {
  return command(
    "delete <id>",
    "Delete one confirmed record",
    async ({ args, options }, c) => {
      const id = String(args.id);
      const path = kind + "/" + pathSegment(id);
      if (options.confirmId !== id)
        usage("Confirmation must exactly match the resource ID.");
      const observed = await document(c, path);
      if (
        !observed ||
        observed.id !== id ||
        (kind === "components" &&
          !Array.isArray(observed.assets))
      )
        throw new CliError(
          "Nexus preflight did not identify the requested record.",
          { code: "nexus.decodeFailed" },
        );
      await mutate(c, path, "DELETE");
      return {
        id,
        acknowledged: true,
        ...(kind === "components"
          ? { observedAssetCount: observed.assets.length }
          : {}),
      };
    },
    {
      permission: Permission.Update,
      view,
      options: [
        {
          flags: "--confirm-id <id>",
          description: "Confirm the exact resource ID",
          required: true,
        },
      ],
    },
  );
}
export const uploadCommand = command(
  "upload",
  "Publish prepared artifacts",
  ["raw", "maven"].map((format) =>
    command(
      format,
      "Publish prepared artifacts",
      async ({ options: o }, c) => {
        if (format === "maven" && o.pom !== undefined) {
          if (typeof o.repository !== "string" || !o.repository.trim()) usage("Repository must be nonempty.");
          const form = await pomImport(o, c);
          await mutate(c, "components?" + new URLSearchParams({repository: String(o.repository)}), "POST", form, 204, {operation: "Upload Maven artifacts", repository: String(o.repository), upload: "maven"});
          return {repository: o.repository, acknowledged: true};
        }
        if (format === "maven" && o.asset !== undefined) usage("Companion assets require --pom.");
        if (format === "maven" && o.generatePom !== undefined && o.generatePom !== "true") usage("Generated-JAR mode requires generate-pom=true.");
        const required =
          format === "raw"
            ? ["repository", "file", "directory"]
            : [
                "repository",
                "file",
                "group",
                "artifact",
                "artifactVersion",
                "extension",
              ];
        for (const k of required)
          if (typeof o[k] !== "string" || !String(o[k]).trim())
            usage("Upload fields must be nonempty.");
        if (format === "maven" && o.extension !== "jar")
          usage("Maven upload requires extension jar.");
        const path = resolve(String(o.file));
        const filename = String(o.filename ?? basename(path));
        if (!filename.trim()) usage("Filename must be nonempty.");
        let blob: Blob;
        try {
          c.signal?.throwIfAborted();
          const stat = await lstat(path);
          if (!stat.isFile()) usage("Upload requires a regular file.");
          blob = await openAsBlob(path);
          c.signal?.throwIfAborted();
        } catch (cause) {
          if (cause instanceof CliError) throw cause;
          throw new CliError("Could not open upload file.", {
            code: "nexus.upload.fileFailed",
            cause: diagnosticCause(cause),
          });
        }
        const form = new FormData();
        const prefix = format === "raw" ? "raw" : "maven2";
        form.set(prefix + ".asset1", blob, filename);
        const fields =
          format === "raw"
            ? {
                "raw.directory": String(o.directory),
                "raw.asset1.filename": filename,
              }
            : {
                "maven2.groupId": String(o.group),
                "maven2.artifactId": String(o.artifact),
                "maven2.version": String(o.artifactVersion),
                "maven2.packaging": "jar",
                "maven2.generate-pom": "true",
                "maven2.asset1.extension": "jar",
              };
        for (const [key, value] of Object.entries(fields))
          form.set(key, value!);
        await mutate(
          c,
          "components?" +
            new URLSearchParams({ repository: String(o.repository) }),
          "POST",
          form,
          204,
          {operation: format === "raw" ? "Upload raw artifacts" : "Upload Maven artifacts", repository: String(o.repository), upload: format as "raw" | "maven"},
        );
        return { repository: String(o.repository), acknowledged: true };
      },
      {
        permission: Permission.Update,
        view,
        options: [
          ...[
            "repository",
            "file",
            ...(format === "raw"
              ? ["directory"]
              : ["group", "artifact", "artifactVersion", "extension"]),
          ].map((k) => ({
            flags: `--${k === "artifactVersion" ? "artifact-version" : k} <value>`,
            description: `Set ${k}`,
            required: format === "raw" || k === "repository",
          })),
          ...(format === "raw"
            ? [
                {
                  flags: "--filename <name>",
                  description: "Set the destination filename",
                },
              ]
            : [
                { flags: "--generate-pom <boolean>", description: "Generate a POM in JAR mode (true only; enabled by default)" },
                { flags: "--pom <file>", description: "Import an original POM" },
                { flags: "--asset <json>", description: "Add a companion asset (repeatable)", parse: collectAsset },
              ]),
        ],
      },
    ),
  ),
);
