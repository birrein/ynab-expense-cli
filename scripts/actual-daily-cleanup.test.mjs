import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the CLI with an isolated API double: no Keychain, server or financial writes.
for (const failure of ['', 'init', 'download', 'query', 'shutdown']) {
 test(`temporary clients: ${failure || 'success'} preserves backups, state and other clients`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'actual-cleanup-test-'));
  try {
   await mkdir(join(root, 'backups'));
   await writeFile(join(root, 'backups', 'budget.zip'), 'backup sentinel');
   await mkdir(join(root, 'client-other-run'));
   await writeFile(join(root, 'client-other-run', 'keep'), 'other execution');
   await writeFile(join(root, 'state.json'), 'state sentinel');
   const api = join(root, 'api.mjs');
   await writeFile(api, `
    import { writeFile } from 'node:fs/promises';
    const failure = ${JSON.stringify(failure)};
    let dir;
    export async function init(options) { dir=options.dataDir; await writeFile(dir+'/download','diagnostic'); if(failure==='init') throw Error('init failed'); return {}; }
    export async function downloadBudget() { if(failure==='download') throw Error('download failed'); }
    export async function getAccounts() { if(failure==='query') throw Error('query failed'); return []; }
    export async function getCategories() { return []; }
    export async function getPayees() { return []; }
    export async function getRules() { return []; }
    export async function getSchedules() { return []; }
    export async function shutdown() { if(failure==='shutdown') throw Error('shutdown failed'); await writeFile(dir+'/closed','yes'); }
   `);
   const original = await readFile(new URL('./actual-daily-operations.mjs', import.meta.url), 'utf8');
   const source = original
    .replace("'./actual-daily-policy.mjs'", JSON.stringify(new URL('./actual-daily-policy.mjs', import.meta.url).href))
    .replaceAll("'./actual-runtime/adapters/daily-state-reader.ts'", JSON.stringify(new URL('./actual-runtime/adapters/daily-state-reader.ts', import.meta.url).href))
    .replaceAll("'./actual-runtime/adapters/santiago-calendar-clock.ts'", JSON.stringify(new URL('./actual-runtime/adapters/santiago-calendar-clock.ts', import.meta.url).href))
    .replace("'./actual-transaction-notes.mjs'", JSON.stringify(new URL('./actual-transaction-notes.mjs', import.meta.url).href))
    .replace("'./actual-note-tags.mjs'", JSON.stringify(new URL('./actual-note-tags.mjs', import.meta.url).href))
    .replace("'./actual-historical-tags.mjs'", JSON.stringify(new URL('./actual-historical-tags.mjs', import.meta.url).href))
    .replaceAll("'./actual-statement-credit.mjs'", JSON.stringify(new URL('./actual-statement-credit.mjs', import.meta.url).href))
    .replace(/const apiPath=.*?;/, `const apiPath=${JSON.stringify(api)};`)
    .replace(/const token=execFileSync[^\n]+/, "const token='isolated-test';");
   const cliDir = join(root, 'cli');
   const runtimeDir = join(cliDir, 'actual-runtime');
   await mkdir(runtimeDir, {recursive:true});
   const entry = (await readFile(new URL('./actual-runtime/actual-daily.ts', import.meta.url), 'utf8'))
    .replaceAll("'./application/get-status.ts'", JSON.stringify(new URL('./actual-runtime/application/get-status.ts', import.meta.url).href))
    .replaceAll("'./adapters/daily-state-reader.ts'", JSON.stringify(new URL('./actual-runtime/adapters/daily-state-reader.ts', import.meta.url).href))
    .replaceAll("'./adapters/santiago-calendar-clock.ts'", JSON.stringify(new URL('./actual-runtime/adapters/santiago-calendar-clock.ts', import.meta.url).href));
   await writeFile(join(runtimeDir, 'package.json'), await readFile(new URL('./actual-runtime/package.json', import.meta.url)));
   await writeFile(join(cliDir, 'actual-daily-operations.mjs'), source);
   await writeFile(join(runtimeDir, 'actual-daily.ts'), entry);
   await writeFile(join(runtimeDir, 'actual-daily-dispatcher.ts'), await readFile(new URL('./actual-runtime/actual-daily-dispatcher.ts', import.meta.url)));
   const result = spawnSync(process.execPath, [join(runtimeDir, 'actual-daily.ts'), 'snapshot', '--currency', 'CLP'], {encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});
   assert.equal(result.status, failure ? 1 : 0, result.stderr);
   if(failure) assert.match(result.stderr, new RegExp(failure+' failed'));
   const ownClients = (await readdir(root)).filter(x=>x.startsWith('client-') && x!=='client-other-run');
   assert.equal(ownClients.length, failure ? 1 : 0);
   if(failure) assert.equal(await readFile(join(root,ownClients[0],'download'),'utf8'),'diagnostic');
   assert.equal(await readFile(join(root,'backups','budget.zip'),'utf8'),'backup sentinel');
   assert.equal(await readFile(join(root,'state.json'),'utf8'),'state sentinel');
   assert.equal(await readFile(join(root,'client-other-run','keep'),'utf8'),'other execution');
  } finally { await rm(root,{recursive:true,force:true}); }
 });
}
