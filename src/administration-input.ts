import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { CliError, type CommandContext } from "@eyeauras/cli-factory";

/** File bodies avoid consuming JSON-RPC's protocol stdin. */
export async function inputDocument(c: CommandContext, path: unknown, protectedFile = false): Promise<unknown> {
  if (typeof path !== "string" || !path) throw new CliError("Supply a JSON input file.", { code: "usage.invalid", exitCode: 2 });
  let file;
  try {
    file = await open(resolve(c.cwd, path), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | constants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile() || (protectedFile && (process.platform === "win32" || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)))
      throw new CliError("Input requires an owner-only regular file.", { code: "nexus.input.unsafe" });
    if (stat.size > 65536) throw new CliError("JSON input must not exceed 64 KiB.", { code: "nexus.input.tooLarge" });
    c.signal.throwIfAborted();
    const bytes = Buffer.alloc(65537);
    let count = 0;
    while (count < bytes.length) {
      c.signal.throwIfAborted();
      const read = await file.read(bytes, count, bytes.length - count, null);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    if (count > 65536) throw new CliError("JSON input must not exceed 64 KiB.", { code: "nexus.input.tooLarge" });
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, count))); }
    catch { throw new CliError("Supply a valid UTF-8 JSON document.", { code: "usage.invalid", exitCode: 2 }); }
  } catch (cause) {
    if (cause instanceof CliError) throw cause;
    throw new CliError("Could not read the input file.", { code: "nexus.input.unavailable" });
  } finally { await file?.close(); }
}
