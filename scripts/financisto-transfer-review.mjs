import { readFile, writeFile } from 'node:fs/promises';
import { parseFinancistoCsv, parseFinancistoAmount } from './financisto-actual-import.mjs';
const source = '/Users/birrein/Library/CloudStorage/GoogleDrive-birrein@gmail.com/Mi unidad/financisto/20220218_141658_957.csv';
const cutoff = '2022-02-18';
const rows = parseFinancistoCsv(await readFile(source, 'utf8')).map((r, i) => ({ ...r, record: i + 1, cents: parseFinancistoAmount(r.amount) }));
const marked = rows.filter(r => /^Transfer (In|Out)$/.test(r.location.trim()));
const buckets = new Map();
for (const r of marked) {
  const key = `${r.date} ${r.time}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(r);
}
const pairs = [], exceptions = [];
for (let [timestamp, members] of buckets) {
  if (members.length > 2) {
    const remaining = new Set(members);
    for (const a of members.filter(r => r.location.trim() === 'Transfer Out')) {
      const matches = [...remaining].filter(b => b.location.trim() === 'Transfer In' && b.currency === a.currency && b.cents === -a.cents && b.account !== a.account && a.cents < 0);
      const rival = [...remaining].filter(b => b.location.trim() === 'Transfer Out' && b.currency === a.currency && b.cents === a.cents);
      if (matches.length === 1 && rival.length === 1) {
        const b = matches[0];
        pairs.push({ timestamp, kind: 'same-currency', included: a.date <= cutoff, outgoing: a, incoming: b });
        remaining.delete(a); remaining.delete(b);
      }
    }
    members = [...remaining];
    if (!members.length) continue;
  }
  const outgoing = members.filter(r => r.location.trim() === 'Transfer Out');
  const incoming = members.filter(r => r.location.trim() === 'Transfer In');
  if (members.length !== 2 || outgoing.length !== 1 || incoming.length !== 1) {
    exceptions.push({ timestamp, reason: 'ambiguous-or-missing-counterpart', members }); continue;
  }
  const a = outgoing[0], b = incoming[0];
  if (a.cents >= 0 || b.cents <= 0 || a.account === b.account) {
    exceptions.push({ timestamp, reason: 'sign-or-account-anomaly', members }); continue;
  }
  const sameCurrency = a.currency === b.currency;
  if (sameCurrency && a.cents + b.cents !== 0) {
    exceptions.push({ timestamp, reason: 'unbalanced-same-currency', members }); continue;
  }
  pairs.push({ timestamp, kind: sameCurrency ? 'same-currency' : 'cross-currency', included: a.date <= cutoff && b.date <= cutoff, outgoing: a, incoming: b });
}
const future = rows.filter(r => r.date > cutoff);
const futureGroups = {};
for (const r of future) {
  const key = `${r.account} | ${r.currency} | ${r.project || r.payee || r.category}`;
  futureGroups[key] = (futureGroups[key] || 0) + 1;
}
const summary = { rows: rows.length, markedRows: marked.length, sameCurrencyPairs: pairs.filter(p => p.kind === 'same-currency').length, crossCurrencyPairs: pairs.filter(p => p.kind === 'cross-currency').length, exceptionGroups: exceptions.length, exceptionRows: exceptions.reduce((n,e)=>n+e.members.length,0), excludedRows: future.length, excludedTransferRows: future.filter(r=>/^Transfer (In|Out)$/.test(r.location.trim())).length, futureGroups };
const report = { source, cutoff, generatedAt: new Date().toISOString(), summary, pairs, exceptions, excludedRows: future };
await writeFile('/Users/birrein/Actual-pilot/financisto-pilot-20260904/transfer-review.json', JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(summary, null, 2));
console.log('Exceptions:', JSON.stringify(exceptions.map(e=>({ timestamp:e.timestamp,reason:e.reason,rows:e.members.map(r=>({record:r.record,account:r.account,amount:r.amount,currency:r.currency,direction:r.location}))})),null,2));
