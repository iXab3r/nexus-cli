import { CliError, command, Permission, recordView } from "@eyeauras/cli-factory";
import { pathSegment } from "./client.js";
import { document, mutate } from "./mutations.js";
const path = "repositories/raw/hosted";
function usage(message: string): never {
    throw new CliError(message, { code: "usage", exitCode: 2 });
}
function boolean(value: unknown): boolean {
    if (value !== "true" && value !== "false")
        usage("Use true or false.");
    return value === "true";
}
/** Project only supported raw hosted settings; unknown response fields are private. */
function project(r: any) {
    if (!r || typeof r.name !== "string" || typeof r.online !== "boolean" ||
        !r.storage || typeof r.storage.blobStoreName !== "string" ||
        typeof r.storage.strictContentTypeValidation !== "boolean" ||
        typeof r.storage.writePolicy !== "string" ||
        !r.component || typeof r.component.proprietaryComponents !== "boolean" ||
        !r.raw || !["INLINE", "ATTACHMENT"].includes(r.raw.contentDisposition) ||
        (r.cleanup != null && (!Array.isArray(r.cleanup.policyNames) ||
            !r.cleanup.policyNames.every((n: unknown) => typeof n === "string"))))
        throw new CliError("Invalid raw hosted configuration.", { code: "nexus.decodeFailed" });
    return {
        name: r.name as string, online: r.online as boolean,
        storage: { blobStoreName: r.storage.blobStoreName as string,
            strictContentTypeValidation: r.storage.strictContentTypeValidation as boolean,
            writePolicy: r.storage.writePolicy as string },
        cleanup: r.cleanup == null ? null : { policyNames: r.cleanup.policyNames as string[] },
        component: { proprietaryComponents: r.component.proprietaryComponents as boolean },
        raw: { contentDisposition: r.raw.contentDisposition as string },
    };
}
export const hostedCommand = command("hosted", "Manage hosted repositories", [
    command("raw", "Manage raw hosted repositories", [
        command("get <name>", "Inspect raw hosted settings", async ({ args }, c) => project(await document(c, path + "/" + pathSegment(String(args.name)))), {
            permission: Permission.ReadOnly,
            view: recordView<ReturnType<typeof project>>({ fields: [
                    { label: "Name", value: r => r.name },
                    { label: "Online", value: r => r.online },
                    { label: "Blob store", value: r => r.storage.blobStoreName },
                    { label: "Write policy", value: r => r.storage.writePolicy },
                    { label: "Strict content type validation", value: r => r.storage.strictContentTypeValidation },
                    { label: "Cleanup policies", value: r => r.cleanup?.policyNames.join(", ") ?? "None" },
                    { label: "Proprietary components", value: r => r.component.proprietaryComponents },
                    { label: "Content disposition", value: r => r.raw.contentDisposition },
                ] }),
        }),
        command("create <name>", "Create a raw hosted repository", async ({ args, options: o }, c) => {
            const name = String(args.name);
            if (!/^[a-zA-Z0-9-][a-zA-Z0-9_.-]*$/.test(name))
                usage("Use a valid repository name.");
            if (typeof o.blobStore !== "string" || !o.blobStore.trim())
                usage("Supply an existing blob store name.");
            if (!["ALLOW", "ALLOW_ONCE", "DENY"].includes(String(o.writePolicy)))
                usage("Use ALLOW, ALLOW_ONCE or DENY for write policy.");
            const body = { name, online: boolean(o.online), storage: {
                    blobStoreName: o.blobStore, writePolicy: o.writePolicy,
                    strictContentTypeValidation: boolean(o.strictContentTypeValidation),
                }, component: { proprietaryComponents: false }, raw: { contentDisposition: "ATTACHMENT" } };
            await mutate(c, path, "POST", JSON.stringify(body), 201);
            return { name, acknowledged: true };
        }, { permission: Permission.Update,
            options: [
                { flags: "--blob-store <name>", description: "Use an existing blob store", required: true },
                { flags: "--write-policy <policy>", description: "Choose ALLOW, ALLOW_ONCE or DENY", required: true },
                { flags: "--online <boolean>", description: "Accept incoming requests (true or false)", required: true },
                { flags: "--strict-content-type-validation <boolean>", description: "Validate content types (true or false)", required: true },
            ], view: recordView<{
                name: string;
                acknowledged: boolean;
            }>({ fields: [
                    { label: "Name", value: r => r.name }, { label: "Acknowledged", value: r => r.acknowledged },
                ] }),
        }),
    ]),
]);
