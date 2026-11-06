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
/** Paths select static read labels only; resource IDs and arbitrary query values are excluded. */
export function readContext(path: string): string {
  const [route, query] = path.split('?');
  const family = route.split('/')[0];
  const label = ['repositories', 'components', 'assets', 'search', 'formats', 'status', 'blobstores'].includes(family) ? family : 'metadata';
  let repository = new URLSearchParams(query).get('repository') ?? undefined;
  if (family === 'repositories' && route.split('/').length === 2) {
    try { repository = decodeURIComponent(route.split('/')[1]); } catch { repository = ''; }
  }
  return operationContext(`Read Nexus ${label}`, repository);
}
