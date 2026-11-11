// Refresh source reachability by native repository format/type, using the frozen inventory.
import { readFileSync, writeFileSync } from "node:fs";
const inventory = JSON.parse(readFileSync(new URL('../docs/api/inventory.json', import.meta.url)));
const reachable = new Set(JSON.parse(readFileSync(new URL('../docs/api/cli-reachability.json', import.meta.url))).operations.map(o => o.operation));
const formats = new Map();
for (const operation of inventory.operations) for (const alias of operation.aliases) {
  const match = /^\/v1\/repositories\/([^/]+)\/(hosted|proxy|group)(?:\/|$)/.exec(alias.path);
  if (!match) continue;
  const [, format, type] = match;
  if (!formats.has(format)) formats.set(format, { hosted: new Set(), proxy: new Set(), group: new Set() });
  formats.get(format)[type].add(alias.method + ' ' + alias.path);
}
const totals = pairs => ({ total: pairs.size, covered: [...pairs].filter(p => reachable.has(p)).length });
const rows = [...formats].map(([format, types]) => ({ format, ...Object.fromEntries(Object.entries(types).map(([type, pairs]) => [type, totals(pairs)])), all: totals(new Set(Object.values(types).flatMap(pairs => [...pairs]))) }));
rows.sort((a, b) => b.all.covered / b.all.total - a.all.covered / a.all.total || a.format.localeCompare(b.format));
const cell = ({ covered, total }) => total ? `${Math.round(100 * covered / total)}% (${covered}/${total})` : '—';
const table = items => '| Format | Hosted | Proxy | Group | Total |\n|---|---:|---:|---:|---:|\n' + items.map(r => `| ${r.format} | ${cell(r.hosted)} | ${cell(r.proxy)} | ${cell(r.group)} | ${cell(r.all)} |`).join('\n');
const selected = rows.filter(r => ['cargo', 'docker', 'npm', 'nuget', 'raw', 'maven'].includes(r.format));
const others = rows.filter(r => !selected.includes(r));
const otherTotal = others.reduce((n, r) => n + r.all.total, 0);
const otherCovered = others.reduce((n, r) => n + r.all.covered, 0);
const readme = table(selected) + `\n\nOther ${others.length} formats: ${otherCovered}/${otherTotal} format-specific operations. [Full per-format table and counting rules](docs/coverage-comparison.md#repository-format-coverage).\n\n100% here means all pinned format-specific REST operations are reachable, not every setting,\nedition or native-client workflow. Common list/get/delete, security and content transfers are\ncounted separately from format-specific administration, including raw/Maven artifact transfers.`;
const sum = rows.reduce((a, r) => ({ covered: a.covered + r.all.covered, total: a.total + r.all.total }), { covered: 0, total: 0 });
const detail = `## Repository format coverage\n\nCurrent source reachability of format-specific repository administration operations in the same\nfrozen specification. Denominators differ: not every format has a group or hosted API.\nA cell counts exact native method/path pairs (typically GET, POST/create and PUT/update).\n\n${table(rows)}\n\n**All formats: ${cell(sum)}.** A dash means the pinned API defines no operation for that type;\nit does not mean an unimplemented CLI command. General repository list/get/delete and settings\nreads remain in the separate Repository Management / General count. Security, components/assets,\nraw/Maven transfers and internal credential protocols do not increase these percentages.\n100% is REST reachability, not full DTO-field, edition, permission or live workflow qualification.\n\nRegenerate both tables with \`node scripts/repository-coverage.mjs\`; verify without writes using\n\`node scripts/repository-coverage.mjs --check\`. Inputs are inventory.json and cli-reachability.json.\n`;
for (const [file, body] of [['README.md', readme], ['docs/coverage-comparison.md', detail]]) {
  const url = new URL('../' + file, import.meta.url), text = readFileSync(url, 'utf8');
  const start = '<!-- repository-coverage:start -->', end = '<!-- repository-coverage:end -->';
  const block = start + '\n' + body + '\n' + end;
  const output = text.includes(start) ? text.slice(0, text.indexOf(start)) + block + text.slice(text.indexOf(end) + end.length) : text.replace(file === 'README.md' ? '## Use it' : '## By inventory group', block + '\n\n' + (file === 'README.md' ? '## Use it' : '## By inventory group'));
  if (process.argv.includes('--check')) { if (output !== text) throw Error(file + ' repository coverage is stale'); }
  else writeFileSync(url, output);
}
console.log(JSON.stringify({ formats: rows.length, ...sum, checked: process.argv.includes('--check') }));
