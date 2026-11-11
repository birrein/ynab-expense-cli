import * as api from '/Users/birrein/.nvm/versions/node/v22.20.0/lib/node_modules/@actual-app/cli/node_modules/@actual-app/api/dist/index.js';
import { mkdir, writeFile, access } from 'node:fs/promises';
const root = '/Users/birrein/Actual-pilot/financisto-pilot-20260904';
await mkdir(root, { recursive: true, mode: 0o700 });
await mkdir(`${root}/client`, { recursive: true, mode: 0o700 });
const runtime = await api.init({ serverURL: 'http://127.0.0.1:5006', sessionToken: process.env.ACTUAL_SESSION_TOKEN, dataDir: `${root}/client` });
const report = [];
try {
  for (const [currency, syncId] of [['CLP', '84c7b3ba-8389-4b0c-9bad-59041c29c0d2'], ['USD', '51e1e127-74c7-4052-8bba-c691d1cb53f1']]) {
    const name = `Prueba Financisto + YNAB ${currency} 2026-09-04`;
    const existingCopy = (await api.getBudgets()).find(b => b.id && b.name === name);
    await api.downloadBudget(syncId);
    const source = (await api.getBudgets()).find(b => b.id && b.groupId === syncId);
    if (!source) throw new Error('Presupuesto original no encontrado');
    await api.loadBudget(source.id);
    await api.sync();
    const accounts = await api.getAccounts();
    let count = 0;
    for (const account of accounts) count += (await api.getTransactions(account.id, '1900-01-01', '2100-01-01')).length;
    if (!await access(`${root}/original-${currency}.zip`).then(() => true, () => false)) await writeFile(`${root}/original-${currency}.zip`, await api.exportBudget(), { mode: 0o600, flag: 'wx' });
    await runtime.send('close-budget');
    const id = existingCopy?.id || await runtime.send('duplicate-budget', { id: source.id, newName: name, cloudSync: true, open: 'copy' });
    if (existingCopy) await api.loadBudget(id);
    const copy = (await api.getBudgets()).find(b => b.id === id);
    if (!copy?.groupId || copy.groupId === syncId) throw new Error('Copia sin Sync ID independiente');
    const rules = await api.getRules();
    await writeFile(`${root}/rules-${currency}.json`, JSON.stringify(rules, null, 2), { mode: 0o600 });
    for (const rule of rules) await api.deleteRule(rule.id);
    await api.sync();
    report.push({ currency, original: source.name, originalSyncId: syncId, sourceTransactions: count, copy });
    await writeFile(`${root}/manifest.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(report.at(-1)));
    await runtime.send('close-budget');
  }
} finally { await api.shutdown(); }
