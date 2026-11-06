#!/usr/bin/env python3
"""Offline deterministic inventory. Run from any directory; writes only beside this file."""
import json, hashlib
from pathlib import Path
from collections import Counter
root=Path(__file__).resolve().parent
raw=(root/'nexus-openapi.json').read_bytes()
expected='2d5261f26dd225103e886c0cb2becfa710b690a19e308a504cdd57a9293407ca'
assert hashlib.sha256(raw).hexdigest()==expected, 'Source pin mismatch'
spec=json.loads(raw); logical={}; pairs=0
ids=Counter(op.get('operationId') for methods in spec['paths'].values() for method,op in methods.items() if method in {'get','post','put','patch','delete','head','options','trace'})
for path, methods in sorted(spec['paths'].items()):
 for method, op in sorted(methods.items()):
  if method not in {'get','post','put','patch','delete','head','options','trace'}: continue
  pairs+=1; identity=op.get('operationId') or method.upper()+' '+path
  original=op.get('operationId')
  if ids[original]>1: identity += ' :: '+method.upper()+' '+path
  record=logical.setdefault(identity,{'identity':identity,'operationId':original,'availability':{'edition':'unknown','evidence':'Aggregated specification does not establish entitlement'},'groups':[], 'aliases':[]})
  record['groups']=sorted(set(record['groups']+op.get('tags',['untagged'])))
  record['aliases'].append({'method':method.upper(),'path':path,'deprecated':op.get('deprecated',False),'summary':op.get('summary'),'responses':sorted(op.get('responses',{}))})
rows=sorted(logical.values(),key=lambda x:x['identity']); counts=Counter();http=Counter()
for r in rows:
 # Primary tag for additive counts; all tags preserved above.
 g=r['groups'][0] if r['groups'] else 'untagged';counts[g]+=1;http[g]+=len(r['aliases'])
for r in rows:
 g=r['groups'][0] if r['groups'] else 'untagged'
 if g == 'Repository Management':
  parts=r['aliases'][0]['path'].strip('/').split('/')
  i=parts.index('repositories') if 'repositories' in parts else -1
  tail=parts[i+1:] if i>=0 else []
  g += ' / '+(' / '.join(tail[:2]) if tail and '{' not in tail[0] else 'General')
 r['trackerRoot']=g
roots=Counter(r['trackerRoot'] for r in rows)
assert len(rows)==442 and len(roots)==120, 'Pinned census changed'
assert max(roots.values()) <= 100
result={'sourceUrl':'https://sonatype.github.io/sonatype-documentation/api/nexus-repository/latest/nexus-repository-api.json','retrieved':'2026-11-06','partitionPolicy':'Service-domain roots; Repository Management split by format/type; maximum 100 operations per root; no fallback needed for this pin','version':spec['info']['version'],'sha256':expected,'logicalOperations':len(rows),'httpPairs':pairs,'grouping':'Unique operationId retained; collisions disambiguated by HTTP method and exact path. First sorted tag is primary count group.','operations':rows}
(root/'inventory.json').write_text(json.dumps(result,indent=2)+'\n')
lines=['# Generated API inventory',f"\nVersion {result['version']}; {len(rows)} logical identities; {pairs} HTTP method/path pairs.",'\nEvery method/path is distinct; original operationId retained. Service-domain tracker roots preserve API semantics. This is a census, not implementation scope.','\n| Primary group | Logical | HTTP pairs |','|---|---:|---:|']
lines += [f'| {g} | {counts[g]} | {http[g]} |' for g in sorted(counts)]
lines+=['\n## Operation identities']
for r in rows:lines.append('\n- `'+r['identity']+'` ('+r['trackerRoot']+'): '+ '; '.join('`'+a['method']+' '+a['path']+'`' for a in r['aliases']))
(root/'inventory.md').write_text('\n'.join(lines)+'\n')
print(f'{len(rows)} identities; {len(roots)} semantic groups; {pairs} HTTP pairs')
