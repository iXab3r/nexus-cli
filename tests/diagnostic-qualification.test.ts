import assert from 'node:assert/strict';
import test from 'node:test';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCli, diagnosticCause } from '@eyeauras/cli-factory';
import { createCliFixture } from '@eyeauras/cli-factory/testing';
import { createDefinition } from '../src/cli.js';

const controls = Array.from({length: 160}, (_, i) => i)
  .filter(i => (i < 32 && i !== 9 && i !== 10) || (i >= 127 && i <= 159))
  .map(i => String.fromCharCode(i)).join('');
const unsafeControls = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/;
const spellings = {
  raw: (value: string) => value,
  upper: (value: string) => encodeURIComponent(value),
  lower: (value: string) => encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, triplet => triplet.toLowerCase()),
  mixed: (value: string) => encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, triplet =>
    triplet.replace(/[A-F]/g, (hex, index) => index === 1 ? hex.toLowerCase() : hex)),
};
const boundaries = ['repository', 'format', 'asset', 'search', 'upload', 'content', 'asset-download', 'search-download', 'asset-delete', 'component-delete'] as const;

// Real commands own resource discovery and the late known-value copy. The injected runtime
// models native transport/body errors without mocking command, client, publisher or renderer.
for (const boundary of boundaries) for (const phase of ['transport', 'body'] as const) {
  if ((boundary === 'upload' || boundary.endsWith('-delete')) && phase === 'body') continue; // 204 acknowledgment never reads a body.
  for (const [spelling, spell] of Object.entries(spellings)) {
    test(`S27 qualification ${boundary} ${phase} ${spelling}`, async t => {
      const resource = 'SYNTHETIC_PRIVATE_é_资源_[x]+_%2f' + (boundary === 'content' ? '' : '\u001b\u0085\u009b');
      const password = 'SYNTHETIC_PAIR_é_[p]+_\u0085';
      const f = await createCliFixture(t, {applicationId: 'nexus-cli', profiles: [{name: 'lab',
        values: {url: 'https://nexus.example.test/context', authMode: 'basic'},
        secrets: {credentials: JSON.stringify({username: 'synthetic-user', password})}}]});
      const output = join(f.root, 'never-published.bin');
      const file = join(f.root, 'synthetic.txt');
      await writeFile(file, 'synthetic upload');
      const deletion = boundary === 'asset-delete' || boundary === 'component-delete';
      const argv = deletion ? [boundary === 'asset-delete' ? 'assets' : 'components', 'delete', resource, '--confirm-id', resource]
        : boundary === 'repository' ? ['repositories', 'get', resource]
        : boundary === 'format' ? ['formats', 'upload-specs', 'get', resource]
        : boundary === 'asset' ? ['assets', 'get', resource]
        : boundary === 'search' ? ['search', 'assets', '--repository', resource]
        : boundary === 'upload' ? ['components', 'upload', 'raw', '--repository', resource, '--file', file, '--directory', '/']
        : boundary === 'content' ? ['content', 'download', '--repository', resource, '--path', 'artifact.bin', '--output', output]
        : boundary === 'asset-download' ? ['assets', 'download', 'synthetic-id', '--output', output]
        : ['search', 'download', '--repository', resource, '--name', 'artifact.bin', '--output', output];
      let calls = 0;
      const a = f.createApplication(runtime => createCli({...createDefinition(), runtime: {...runtime, fetch: async (input, init) => {
        calls++;
        const url = String(input);
        if (deletion && init?.method !== 'DELETE') return Response.json({id:resource, assets:[]});
        if (boundary === 'asset-download' && url.endsWith('/assets/synthetic-id')) {
          return Response.json({path: 'artifact.bin', downloadUrl: 'https://nexus.example.test/content/' + encodeURIComponent(resource)});
        }
        const knownResource = boundary === 'asset-download' ? decodeURIComponent(new URL(url).pathname) : resource;
        const native = Object.assign(new Error(`socket failed ${spell(knownResource)} ${spell(url)} ${spell(password)} ${controls}`), {code: 'ECONNRESET'});
        native.name = 'NativeSocket' + controls + spell(knownResource);
        native.stack = `${native.name}: ${native.message}\n    at syntheticTransport (qualification-native.js:17:3)\n    at privateResource (${spell(knownResource)}:2:1)`;
        const related = Object.assign(new Error('related failure ' + spell(knownResource)), {code: 73});
        related.name = 'Related' + controls;
        const coded = Object.assign(new Error('coded failure ' + spell(knownResource)), {code: 'E_SYNTHETIC' + controls + spell(knownResource)});
        const cause = new TypeError('native operation failed', {cause: native});
        const failure = new AggregateError([related, coded], 'related operations failed', {cause});
        // Core readers/transports also copy before Nexus has resource values. Make that
        // ordering explicit so already-escaped C1 resource spellings cannot bypass the gate.
        const earlyCopy = diagnosticCause(failure);
        if (phase === 'transport') throw earlyCopy;
        return new Response(new ReadableStream({start(controller) {controller.error(earlyCopy);}}));
      }}}));
      await f.run(a, ['permissions', 'grant', 'Update', '--profile', 'lab']);
      const download = boundary === 'content' || boundary === 'asset-download' || boundary === 'search-download';
      function safe(text: string) {
        assert.doesNotMatch(text, /SYNTHETIC_PRIVATE|SYNTHETIC_PAIR/, 'known resource or credential survived');
        assert.doesNotMatch(text, unsafeControls, 'terminal control survived');
        assert.match(text, /socket failed/, 'native detail was erased');
      }
      function machine(error: any, verbose: boolean) {
        safe(JSON.stringify(error));
        const pending = [error];
        const codes: unknown[] = [];
        const frames: string[] = [];
        const names: string[] = [];
        while (pending.length) {
          const item = pending.pop();
          if (!item || typeof item !== 'object') continue;
          for (const key of ['name', 'message', 'code', 'stack']) {
            if (typeof item[key] === 'string') assert.doesNotMatch(item[key], unsafeControls);
          }
          codes.push(item.code);
          if (typeof item.name === 'string') names.push(item.name);
          if (item.stack) frames.push(item.stack);
          if (!verbose) assert.equal(item.stack, undefined);
          if (item.cause) pending.push(item.cause);
          pending.push(...(item.errors ?? []));
        }
        assert.ok(codes.includes('ECONNRESET'));
        assert.ok(codes.includes(73));
        assert.ok(codes.some(code => typeof code === 'string' && code.startsWith('E_SYNTHETIC')));
        assert.ok(names.some(name => name.startsWith('NativeSocket')));
        if (verbose) assert.ok(frames.some(frame => /\n    at syntheticTransport \(qualification-native\.js:17:3\)/.test(frame)));
      }
      for (const verbose of [false, true]) {
        for (const json of [false, true]) {
          const r = await f.run(a, [...argv, '--profile', 'lab', ...(json ? ['--json'] : []), ...(verbose ? ['--verbose'] : [])]);
          assert.equal(r.exitCode, 1);
          safe(r.stderr);
          if (json) machine(JSON.parse(r.stderr).error, verbose);
          else if (verbose) assert.match(r.stderr, /qualification-native\.js:17:3/);
          else {
            assert.doesNotMatch(r.stderr, /qualification-native\.js|Caused by:|Related error:/);
            assert.ok((r.stderr.match(/Cause:/g) ?? []).length <= 1);
          }
          if (download && json) assert.deepEqual(JSON.parse(r.stdout), {published: false, cleanupFailed: false});
          else if (boundary === 'search' && json) assert.deepEqual(JSON.parse(r.stdout), {items: [], pagesFetched: 0, complete: false, continuationToken: null, resume: {restart: true, token: null}, reason: 'fetchFailed'});
          else if (!download && boundary !== 'search') assert.equal(r.stdout, '');
          if (deletion && json) assert.equal(JSON.parse(r.stderr).error.code, 'nexus.mutation.outcomeUnknown');
        }
        const rpc = await f.rpc(a, [[...argv, '--profile', 'lab', ...(verbose ? ['--verbose'] : [])]]);
        machine((rpc[0] as any).error.data, verbose);
        if (download) assert.deepEqual((rpc[0] as any).error.data.result, {published: false, cleanupFailed: false});
      }
      assert.equal(calls, boundary === 'asset-download' || deletion ? 12 : 6, 'no retry or extra preflight');
      if (download) await assert.rejects(access(output), {code: 'ENOENT'});
    });
  }
}
