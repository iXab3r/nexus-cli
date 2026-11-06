import {
  CliError,
  command,
  Permission,
  readResponseBody,
  diagnosticCause,
  recordView,
  type CommandContext,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import { checked, pathSegment } from "./client.js";
type Item = Record<string, unknown>;
interface PageResult {
  items: Item[];
  pagesFetched: number;
  complete: boolean;
  continuationToken: string | null;
  resume: { restart: boolean; token: string | null } | null;
  reason: string | null;
}
const limits = {
  maxPages: 100,
  maxPageBytes: 4194304,
  maxPageItems: 1000,
  maxItems: 10000,
  maxResultBytes: 16777216,
};
const flags = {
  maxPages: "max-pages",
  maxPageBytes: "max-page-bytes",
  maxPageItems: "max-page-items",
  maxItems: "max-items",
  maxResultBytes: "max-result-bytes",
};
const budgetOptions: OptionDefinition[] = Object.entries(limits).map(
  ([key, max]) => ({
    flags: `--${flags[key as keyof typeof flags]} <number>`,
    description: "Limit enumeration resources",
    parse: (v) => {
      if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > max)
        throw new CliError(`Limit must be between 1 and ${max}.`, {
          code: "usage",
          exitCode: 2,
        });
      return Number(v);
    },
  }),
);
function item(v: unknown): Item {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    typeof (v as Item).id !== "string"
  )
    throw new Error("Invalid Nexus item.");
  const r = { ...(v as Item) };
  if (typeof r.downloadUrl === "string") {
    try {
      const u = new URL(r.downloadUrl);
      u.username = "";
      u.password = "";
      u.search = "";
      u.hash = "";
      r.downloadUrl = u.href;
    } catch {
      r.downloadUrl = null;
    }
  }
  if (Array.isArray(r.assets)) r.assets = r.assets.map(item);
  return r;
}
async function body(
  c: CommandContext,
  path: string,
  maxBytes: number,
): Promise<unknown> {
  const response = await checked(c, path);
  const bytes = await readResponseBody(response, {
    maxBytes,
    signal: c.signal,
  });
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
/** Read complete pages, retaining the first undelivered checkpoint on failure. */
export async function enumerate(
  c: CommandContext,
  path: string,
  o: Record<string, unknown>,
): Promise<PageResult> {
  const b = {
    ...limits,
    ...Object.fromEntries(
      Object.keys(limits)
        .filter((k) => o[k] !== undefined)
        .map((k) => [k, o[k]]),
    ),
  } as typeof limits;
  const query = new URLSearchParams();
  for (const [key, wire] of Object.entries({
    repository: "repository",
    name: "name",
    version: "version",
    group: "group",
    format: "format",
    q: "q",
    mavenExtension: "maven.extension",
    mavenClassifier: "maven.classifier",
  }))
    if (o[key] !== undefined) query.set(wire, String(o[key]));
  let token =
    o.continuationToken === undefined ? null : String(o.continuationToken);
  const seen = new Set<string>();
  if (token !== null) seen.add(token);
  const r: PageResult = {
    items: [],
    pagesFetched: 0,
    complete: false,
    continuationToken: token,
    resume: { restart: token === null, token },
    reason: null,
  };
  // Even a failed first page must fit, including the caller's opaque checkpoint.
  // Reserve the longest reason before admitting HTTP or any complete page.
  if (Buffer.byteLength(JSON.stringify({ ...r, reason: "repeatedToken" }), "utf8") > b.maxResultBytes) {
    throw new CliError("Result byte limit cannot hold the initial continuation checkpoint.", {
      code: "usage",
      exitCode: 2,
    });
  }
  function fail(reason: string, cause?: unknown): never {
    r.reason = reason;
    throw new CliError("Nexus enumeration stopped.", {
      code: "nexus.pagination." + reason,
      exitCode: 1,
      result: r,
      cause,
    });
  }
  for (let page = 0; page < (o.all ? b.maxPages : 1); page++) {
    r.resume = { restart: token === null, token };
    if (token !== null) query.set("continuationToken", token);
    else query.delete("continuationToken");
    let raw: any;
    try {
      raw = await body(c, path + "?" + query, b.maxPageBytes);
    } catch (cause) {
      const text = String((cause as Error)?.cause);
      fail(
        /byte bound/.test(text)
          ? "byteBudget"
          : cause instanceof SyntaxError || cause instanceof TypeError
            ? "decodeFailed"
            : "fetchFailed",
        diagnosticCause(cause, [], "Invalid or incomplete Nexus response."),
      );
    }
    let items: Item[];
    try {
      if (
        !raw ||
        !Array.isArray(raw.items) ||
        (raw.continuationToken !== null &&
          typeof raw.continuationToken !== "string")
      )
        throw new Error("Invalid page.");
      items = raw.items.map(item);
    } catch {
      fail("decodeFailed");
    }
    if (
      items!.length > b.maxPageItems ||
      r.items.length + items!.length > b.maxItems
    )
      fail("itemBudget");
    const next = raw.continuationToken as string | null;
    const candidate: PageResult = {
      items: [...r.items, ...items!],
      pagesFetched: r.pagesFetched + 1,
      complete: next === null,
      continuationToken: next,
      resume: next === null ? null : { restart: false, token: next },
      reason: null,
    };
    // Reserve diagnostic/checkpoint overhead before accepting the complete page.
    if (
      Buffer.byteLength(
        JSON.stringify({ ...candidate, reason: "repeatedToken" }),
        "utf8",
      ) > b.maxResultBytes
    )
      fail("byteBudget");
    Object.assign(r, candidate);
    if (next === null) return r;
    if (seen.has(next)) {
      r.resume = null;
      fail("repeatedToken");
    }
    seen.add(next);
    token = next;
  }
  if (o.all) fail("pageBudget");
  return r;
}
const pageView = recordView<PageResult>({
  fields: [
    { label: "Items", value: (r) => r.items.length },
    { label: "Pages fetched", value: (r) => r.pagesFetched },
    { label: "Complete", value: (r) => r.complete },
    { label: "Continuation token", value: (r) => r.continuationToken },
  ],
  sections: [
    {
      title: () => "Metadata",
      lines: (r) =>
        r.items.map((i) =>
          [i.id, i.name, i.version, i.path]
            .filter((v) => typeof v === "string")
            .join("  "),
        ),
    },
  ],
});
const detailView = recordView<Item>({
  fields: [
    "id",
    "repository",
    "format",
    "group",
    "name",
    "version",
    "path",
    "downloadUrl",
    "fileSize",
  ].map((k) => ({ label: k, value: (r) => String(r[k] ?? "") })),
  sections: [
    {
      title: () => "Assets",
      lines: (r) =>
        Array.isArray(r.assets)
          ? r.assets.map((a: Item) =>
              [a.id, a.path, a.downloadUrl]
                .filter((v) => typeof v === "string")
                .join("  "),
            )
          : undefined,
    },
    {
      title: () => "Checksums",
      lines: (r) =>
        r.checksum && typeof r.checksum === "object"
          ? Object.entries(r.checksum).map(
              ([key, value]) => `${key}: ${String(value)}`,
            )
          : undefined,
    },
  ],
});
function listing(name: string, path: string, search = false) {
  return command(
    name,
    "List matching metadata",
    ({ options }, c) => enumerate(c, path, options),
    {
      permission: Permission.ReadOnly,
      view: pageView,
      options: [
        {
          flags: "--repository <name>",
          description: "Select a repository",
          required: !search,
        },
        {
          flags: "--continuation-token <token>",
          description: "Resume from a continuation token",
        },
        { flags: "--all", description: "Read all pages within limits" },
        ...budgetOptions,
        ...(search
          ? [
              "name",
              "version",
              "group",
              "format",
              "q",
              ...(path.endsWith("/assets")
                ? ["maven-extension", "maven-classifier"]
                : []),
            ].map((k) => ({
              flags: `--${k} <value>`,
              description: "Filter matching metadata",
            }))
          : []),
      ],
    },
  );
}
export const readCommands = [
  ...["components", "assets"].map((kind) =>
    command(kind, "Inspect repository metadata", [
      listing("list", kind),
      command(
        "get <id>",
        "Inspect one metadata record",
        async ({ args }, c) => {
          try {
            return item(
              await body(
                c,
                kind + "/" + pathSegment(String(args.id)),
                limits.maxPageBytes,
              ),
            );
          } catch (cause) {
            if (cause instanceof CliError) throw cause;
            throw new CliError("Could not decode Nexus metadata.", {
              code: "nexus.decodeFailed",
              cause: diagnosticCause(
                cause,
                [],
                "Invalid or incomplete Nexus response.",
              ),
            });
          }
        },
        { permission: Permission.ReadOnly, view: detailView },
      ),
    ]),
  ),
  command("search", "Find repository metadata", [
    listing("components", "search", true),
    listing("assets", "search/assets", true),
  ]),
];
