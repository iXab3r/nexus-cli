import { CliError, type CommandContext } from "@eyeauras/cli-factory";

/** Finite invocation input, consumed only after Core permission admission. */
export async function inputDocument(c: CommandContext): Promise<unknown> {
  if (c.io.input.readableEnded || c.io.input.destroyed) throw new CliError("JSON stdin is unavailable through this transport.", { code: "usage.invalid", exitCode: 2 });
  const input = c.io.input;
  const text = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const finish = (error?: Error) => {
      input.pause();
      input.off("data", data); input.off("end", end); input.off("error", failed); input.off("close", closed);
      c.signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const data = (value: string | Buffer) => {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      bytes += chunk.length;
      if (bytes > 65536) finish(new CliError("JSON input must not exceed 64 KiB.", { code: "usage.invalid", exitCode: 2 }));
      else chunks.push(chunk);
    };
    const end = () => finish();
    const failed = () => finish(new CliError("Could not read JSON input.", { code: "usage.invalid", exitCode: 2 }));
    const closed = () => failed();
    const aborted = () => finish(new DOMException("Input cancelled.", "AbortError"));
    input.on("end", end); input.on("error", failed); input.on("close", closed);
    c.signal.addEventListener("abort", aborted, { once: true });
    input.on("data", data);
    if (c.signal.aborted) aborted();
  });
  try { return JSON.parse(text); }
  catch { throw new CliError("Supply a JSON document on stdin.", { code: "usage.invalid", exitCode: 2 }); }
}
