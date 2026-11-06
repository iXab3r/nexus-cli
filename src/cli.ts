import { hostedCommand } from "./hosted.js";
import { formatsCommand } from './mutations.js';
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
              columns: fields.map((k) => ({ header: k, value: (r) => r[k] })),
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
              fields: fields.map((k) => ({ label: k, value: (r) => r[k] })),
            }),
          },
        ),
      ]),
    ],
  };
}
