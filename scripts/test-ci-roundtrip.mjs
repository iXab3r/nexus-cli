import assert from 'node:assert/strict';
import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Test-only boundary doubles; installed parsing, profiles, HTTP and publisher stay real.
export async function ciRoundtrip({root, temp, prefix, env, executable}) {
  const state = join(temp, 'ci-state.json');
  const wire = join(temp, 'ci-wire.bin');
  const trace = join(temp, 'ci-trace');
  await writeFile(state, '{}');
  await writeFile(trace, '');
  const store = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', '@eyeauras/nexus-cli/node_modules/@eyeauras/cli-factory/dist/src/secret-store.js');
  const preload = join(temp, 'ci-preload.mjs');
  await writeFile(preload, `
import {PlatformSecretStore} from ${JSON.stringify(pathToFileURL(store).href)};
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
const state=${JSON.stringify(state)}, wire=${JSON.stringify(wire)}, trace=${JSON.stringify(trace)};
PlatformSecretStore.prototype.get=async function(s,a){return JSON.parse(readFileSync(state))[s+':'+a]};
PlatformSecretStore.prototype.set=async function(s,a,v){const x=JSON.parse(readFileSync(state));x[s+':'+a]=v;writeFileSync(state,JSON.stringify(x))};
PlatformSecretStore.prototype.delete=async function(s,a){const x=JSON.parse(readFileSync(state));delete x[s+':'+a];writeFileSync(state,JSON.stringify(x))};
globalThis.fetch=async (url,init)=>{
 const u=String(url);appendFileSync(trace,init.method+' '+u+'\\n');
 if(new Headers(init.headers).get('authorization')!=='Basic '+Buffer.from('synthetic-ci:synthetic-pass-code').toString('base64')) return new Response(null,{status:401});
 if(u==='https://nexus.example.test/context/service/rest/v1/repositories')return Response.json([]);
 if(u==='https://nexus.example.test/context/service/rest/v1/components?repository=releases' && init.method==='POST'){
 if(process.env.CI_REJECT==='1')return new Response(null,{status:403});
 if(init.body.get('raw.directory')!=='ci' || init.body.get('raw.asset1.filename')!=='artifact.bin')throw Error('Wrong raw fields');
 writeFileSync(wire,Buffer.from(await init.body.get('raw.asset1').arrayBuffer()));return new Response(null,{status:204});}
 if(u==='https://nexus.example.test/context/repository/releases/ci/artifact.bin')return new Response(readFileSync(wire));
 throw Error('Unexpected CI request');
};`);
  const ciEnv = {...env, NODE_OPTIONS: env.NODE_OPTIONS + ' --import ' + JSON.stringify(pathToFileURL(preload).href)};
  const logs = [];
  function invoke(args, input, expected=0, extra={}) {
    const r=spawnSync(executable,[...args,'--profile','ci','--json'],{cwd:temp,env:{...ciEnv,...extra},input,encoding:'utf8',timeout:30000});
    assert.equal(r.error,undefined); logs.push(r.stdout+r.stderr);
    assert.equal(r.status,expected,r.stderr);
    return r;
  }
  const created=spawnSync(executable,['profile','create','ci','--json'],{cwd:temp,env:ciEnv,encoding:'utf8'});
  assert.equal(created.status,0,created.stderr);
  const before=spawnSync(executable,['profile','show','--json'],{cwd:temp,env,encoding:'utf8'});
  invoke(['profile','configure','ci','--url','https://nexus.example.test/context','--credentials-stdin'],JSON.stringify({username:'synthetic-ci',password:'synthetic-pass-code'}));
  const source=join(temp,'ci-source.bin');
  const bytes=Buffer.from([0,255,1,2,10,13,128]);
  await writeFile(source,bytes);
  const upload=['components','upload','raw','--repository','releases','--directory','ci','--filename','artifact.bin','--file',source];
  const prior=await readFile(trace,'utf8');
  invoke(upload,undefined,1);
  assert.equal(await readFile(trace,'utf8'),prior,'Local gate must make zero HTTP requests');
  invoke(['permissions','grant','Update']);
  assert.equal(JSON.parse(invoke(upload).stdout).acknowledged,true);
  const sha=createHash('sha256').update(bytes).digest('hex');
  const output=join(temp,'ci-output.bin');
  const download=['content','download','--repository','releases','--path','ci/artifact.bin'];
  const result=JSON.parse(invoke([...download,'--output',output,'--sha256',sha]).stdout);
  assert.equal(result.verified,true);assert.equal(result.bytes,bytes.length);assert.equal(result.sha256,sha);
  assert.deepEqual(await readFile(output),bytes);
  const bad=join(temp,'ci-bad.bin');
  const failed=invoke([...download,'--output',bad,'--sha256','0'.repeat(64)],undefined,1);
  assert.equal(JSON.parse(failed.stdout).published,false);
  await assert.rejects(access(bad));
  // A failed command throws before the next recipe command can execute.
  const checkpoint=await readFile(trace,'utf8');
  assert.throws(()=>{invoke(upload,undefined,0,{CI_REJECT:'1'});invoke([...download,'--output',bad]);});
  assert.equal((await readFile(trace,'utf8')).slice(checkpoint.length).trim().split('\n').length,1);
  await assert.rejects(access(bad));
  invoke(['auth','logout']);
  assert.deepEqual(JSON.parse(await readFile(state,'utf8')),{});
  const after=spawnSync(executable,['profile','show','--json'],{cwd:temp,env,encoding:'utf8'});
  assert.equal(after.status,before.status);assert.equal(after.stdout,before.stdout);assert.equal(after.stderr,before.stderr);
  const secrets = ['synthetic-ci','synthetic-pass-code',Buffer.from('synthetic-ci:synthetic-pass-code').toString('base64')];
  for(const secret of secrets)assert.ok(!logs.join('').includes(secret));
  const readme=await readFile(join(root,'README.md'),'utf8');
  assert.match(readme,/CI artifact roundtrip/,'S28 runnable recipe must be shipped in README');
  const recipe=readme.split('## CI artifact roundtrip')[1].match(/```bash\n([\s\S]*?)```/)[1];
  const recipeHome=join(temp,'recipe-home');await mkdir(recipeHome);
  const credentials=join(temp,'synthetic-input.json');
  await writeFile(credentials,JSON.stringify({username:'synthetic-ci',password:'synthetic-pass-code'}));
  const recipeOutput=join(temp,'recipe-output.bin');
  const recipeEnv={...ciEnv,HOME:recipeHome,USERPROFILE:recipeHome,APPDATA:recipeHome,XDG_CONFIG_HOME:recipeHome,
    PATH:join(prefix,'bin')+':'+env.PATH,NEXUS_URL:'https://nexus.example.test/context',REPOSITORY:'releases',SOURCE:source,DESTINATION:recipeOutput,CREDENTIALS_JSON:credentials};
  const recipeRun=spawnSync('bash',['-c',recipe],{cwd:temp,env:recipeEnv,encoding:'utf8',timeout:30000});
  assert.equal(recipeRun.error,undefined);assert.equal(recipeRun.status,0,recipeRun.stderr);
  assert.deepEqual(await readFile(recipeOutput),bytes);
  assert.deepEqual(JSON.parse(await readFile(state,'utf8')),{});
  for(const secret of secrets)assert.ok(!(recipeRun.stdout+recipeRun.stderr).includes(secret));
  const failedHome=join(temp,'failed-recipe-home');await mkdir(failedHome);
  const failedOutput=join(temp,'failed-recipe.bin');
  const beforeFailure=await readFile(trace,'utf8');
  const failedRecipe=spawnSync('bash',['-c',recipe],{cwd:temp,encoding:'utf8',timeout:30000,
    env:{...recipeEnv,HOME:failedHome,USERPROFILE:failedHome,APPDATA:failedHome,XDG_CONFIG_HOME:failedHome,DESTINATION:failedOutput,CI_REJECT:'1'}});
  assert.equal(failedRecipe.error,undefined);assert.equal(failedRecipe.status,1);
  for(const secret of secrets)assert.ok(!(failedRecipe.stdout+failedRecipe.stderr).includes(secret));
  await assert.rejects(access(failedOutput));
  assert.ok(!(await readFile(trace,'utf8')).slice(beforeFailure.length).includes('/repository/'));
  assert.deepEqual(JSON.parse(await readFile(state,'utf8')),{});


  console.log('S28 packaged CI profile/gate/raw upload/direct digest/failure/logout isolation passed.');
}
