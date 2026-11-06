import type { TestContext } from "node:test";
import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { createCli } from "@eyeauras/cli-factory";
import { createCliFixture } from "@eyeauras/cli-factory/testing";
import { createDefinition } from "../src/cli.js";

/** Use serial tests within each file: MSW intercepts the process fetch boundary. */
export async function offlineCli(t: TestContext, ...handlers: RequestHandler[]) {
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: "error" });
  t.after(() => server.close());
  const fixture = await createCliFixture(t, { applicationId: "nexus-cli" });
  const app = fixture.createApplication(runtime => createCli({ ...createDefinition(), runtime }));
  return { server, fixture, app };
}
