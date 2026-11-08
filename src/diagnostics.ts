import { diagnosticCause } from "@eyeauras/cli-factory";

/** Only conservative, bounded repository labels enter diagnostics; never print paths or queries. */
export function operationContext(operation: string, repository?: string): string {
  return operation + (repository === undefined ? '' : /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(repository)
    ? ` in repository '${repository}'` : ' in the selected repository');
}
/** Static Nexus guidance describes possibilities, not an inferred server diagnosis. */
export function statusMessage(status: number, context: string, upload?: 'raw' | 'maven'): string {
  if (status === 401) return `${context}: authentication was rejected for this request.`;
  if (status === 403) return `${context}: Nexus denied this action; check repository access and action privileges.`;
  if (status === 400) return `${context}: Nexus rejected the request; check ${upload === 'raw'
    ? 'raw.directory, raw.asset1 and raw.asset1.filename, repository format and deployment policy'
    : upload === 'maven' ? 'maven2 coordinates or original POM, maven2.assetN, extension/classifier fields, repository format and deployment policy'
    : 'submitted parameters and repository policy'}.`;
  return `${context}: Nexus returned HTTP ${status}; the expected acknowledgment was not received.`;
}
/** Known resource spellings use Core's existing recursive diagnostic redaction. */
export function resourceRedactions(url: string, ...resources: (string | undefined)[]): string[] {
  const values = new Set<string>();
  for (const value of [url, ...resources]) {
    if (!value) continue;
    values.add(value);
    try {
      // Core may already have replaced URL queries before the integration catches a cause.
      const parsed = new URL(value);
      const pathname = parsed.pathname;
      for (const [key, selector] of parsed.searchParams) {
        if (selector && !["sort", "direction", "timeout"].includes(key)) {
          // Form serialization uses '+' for spaces and escapes more punctuation than URI encoding.
          const form = new URLSearchParams([["", selector]]).toString().slice(1);
          // Early generic sanitization can change one part of a decoded value. Keep its
          // whitespace-delimited parts private independently of those transformations.
          for (const spelling of new Set([selector, ...selector.split(/\s+/).filter(Boolean), encodeURIComponent(selector), form])) {
            values.add(spelling);
            // A lower boundary may have applied Core's generic URL/credential redaction first.
            const sanitized = diagnosticCause(new Error(spelling)).message;
            values.add(sanitized);
            // WHATWG adds '/' to a bare authority; adjacent diagnostic punctuation may
            // become part of that authority before Core normalizes it. Match the stable
            // prefix too, using Core's result rather than reproducing its URL policy.
            if (sanitized.endsWith('/')) values.add(sanitized.slice(0, -1));
          }
        }
      }
      if (pathname !== '/') {
        values.add(pathname);
        values.add(decodeURIComponent(pathname));
      }
    } catch { /* An opaque repository name is still redacted literally. */ }
  }
  return [...values];
}
/** Extract the known repository value without using it as a diagnostic label. */
export function readRepository(path: string): string | undefined {
  const [route, query] = path.split('?');
  if (route.startsWith('repositories/') && route.split('/').length === 2) {
    try { return decodeURIComponent(route.split('/')[1]); } catch { return undefined; }
  }
  return new URLSearchParams(query).get('repository') ?? undefined;
}
/** Recover known opaque read selectors for redaction only, never for diagnostic labels. */
export function readResource(path: string): string | undefined {
  const route = path.split('?')[0];
  const match = /^(?:assets|components)\/([^/]+)$|^formats\/([^/]+)\/upload-specs$|^blobstores\/([^/]+)\/quota-status$/.exec(route);
  if (match) {
    try { return decodeURIComponent(match[1] ?? match[2] ?? match[3]); } catch { return undefined; }
  }
  return readRepository(path);
}
/** Paths select static read labels only; resource IDs and arbitrary query values are excluded. */
export function readContext(path: string): string {
  const family = path.split('/')[0].split('?')[0];
  const label = ['repositories', 'components', 'assets', 'search', 'formats', 'status', 'blobstores'].includes(family) ? family : 'metadata';
  return operationContext(`Read Nexus ${label}`, readRepository(path));
}
