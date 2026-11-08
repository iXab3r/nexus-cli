import { downloadCommand } from "./downloads.js";
import { hostedCommand } from "./hosted.js";
import { blobstoresCommand, formatsCommand } from "./discovery.js";
import { readFileSync } from "node:fs";
import {
  command,
  Permission,
  parseServerUrl,
  recordView,
  tableView,
  type CliDefinition,
} from "@eyeauras/cli-factory";
import { readCommands } from "./reads.js";
import { nexusAuth } from "./auth.js";
import { checked, repositories, type Repository } from "./client.js";
const metadata = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };
const fields = ["name", "format", "type", "url", "online"] as const;
/** Human views escape terminal controls without changing admitted machine strings. */
const repositoryText = (value: string) => value.replace(/[\x00-\x1f\x7f-\x9f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const repositoryFields = [
  ...fields.map(k => ({ label: k, value: (r: Repository) => {
    const value = r[k];
    if (typeof value === "string") return repositoryText(value);
    return value === null ? (k === "url" ? "not displayable" : "not reported") : value;
  } })),
  { label: "Reported size (B)", value: (r: Repository) => r.size === undefined ? "not reported" : String(r.size) },
  { label: "Upstream URL", value: (r: Repository) => {
    const url = r.attributes?.proxy?.remoteUrl;
    return url === undefined ? "not reported" : url === null ? "not displayable" : url === "" ? "(empty)" : repositoryText(url);
  } },
];
/** One command tree for terminal, JSON and persistent RPC callers. */
export function createDefinition(): CliDefinition {
  return {
    name: "nexus-cli",
    description: "Inspect Nexus connections and repositories",
    version: metadata.version,
    profile: {
      defaults: { authMode: "basic" },
      fields: [
        {
          name: "url",
          flags: "--url <url>",
          description: "Set the Nexus installation URL",
          required: true,
          normalize: (v) =>
            parseServerUrl(
              v,
              "Use http(s)://host[:port][/context].",
            ).href.replace(/\/$/, ""),
        },
        {
          name: "authMode",
          flags: "--auth-mode <mode>",
          description: "Choose basic or anonymous authentication",
          normalize: (v) => {
            if (v !== "basic" && v !== "anonymous")
              throw new Error(
                "Authentication mode must be basic or anonymous.",
              );
            return v;
          },
        },
      ],
    },
    auth: nexusAuth,
    permissions: {},
    commands: [
      ...readCommands,
      command("content", "Retrieve known repository content", [downloadCommand(false, true)]),
      blobstoresCommand,
      formatsCommand,
      command(
        "status",
        "Check readable and writable availability",
        async (_input, c) => {
          void (await checked(c, "status")).body?.cancel();
          void (await checked(c, "status/writable")).body?.cancel();
          return { readable: true, writable: true };
        },
        {
          permission: Permission.ReadOnly,
          view: recordView<{ readable: boolean; writable: boolean }>({
            fields: [
              { label: "Readable", value: (r) => r.readable },
              { label: "Writable", value: (r) => r.writable },
            ],
          }),
        },
      ),
      command("repositories", "Inspect visible repositories", [
        hostedCommand,
        command(
          "list",
          "List visible repositories",
          (_input, c) => repositories(c),
          {
            permission: Permission.ReadOnly,
            view: tableView<Repository>({
              columns: repositoryFields.map(({ label, value }) => ({ header: label, value })),
              empty: "No visible repositories.",
            }),
          },
        ),
        command(
          "get <name>",
          "Inspect one repository",
          ({ args }, c) => repositories(c, String(args.name)),
          {
            permission: Permission.ReadOnly,
            view: recordView<Repository>({
              fields: repositoryFields,
            }),
          },
        ),
      ]),
    ],
  };
}
