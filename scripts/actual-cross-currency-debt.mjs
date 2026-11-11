import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canonical(a),canonical(b),m);
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const note=p=>`${p.reference}\nTraspaso de deuda internacional a nacional; no es consumo ni ingreso.\nhttps://drive.google.com/file/d/${p.statementFileId}/view`;
function transactionMatches(t,leg,p){return t.account===leg.account&&t.date===p.date&&t.amount===leg.amount&&t.category===leg.category&&t.imported_id===leg.sourceId&&t.notes===note(p)&&!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id}
export function classifyCrossCurrencyDebt(p,s,ledger){
 assert(p?.crossCurrencyDebtTransfer===true,'Expected cross-currency debt transfer');
 eq(Object.keys(p).sort(),['clp','crossCurrencyDebtTransfer','date','evidence','reference','statementFileId','usd'].sort(),'Unexpected fields');
 assert(validDate(p.date),'Invalid date');
 const rappi=p.reference===`FX-RAPPICARD-STATEMENT-${p.date}`;
 assert(rappi||p.reference===`FX-BCH-STATEMENT-${p.date}`,'Invalid shared reference');
 assert(typeof p.statementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId),'Invalid statement');assert(typeof p.evidence==='string'&&p.evidence.trim().length>=40,'Evidence missing');
 for(const [currency,leg] of [['clp',p.clp],['usd',p.usd]]){
  assert(leg&&typeof leg==='object');eq(Object.keys(leg).sort(),['account','amount','category','sourceId'].sort(),'Unexpected leg fields');
  assert(typeof leg.account==='string'&&leg.account&&typeof leg.category==='string'&&leg.category,'Missing account/category');
  assert(Number.isSafeInteger(leg.amount)&&(currency==='clp'?leg.amount<0:leg.amount>0),'Invalid leg amount');
  assert(typeof leg.sourceId==='string'&&/^bank:[A-Za-z0-9:_-]+$/.test(leg.sourceId),'Invalid source');
  const snapshot=s[currency];assert(snapshot?.accounts.some(a=>a.id===leg.account&&!a.closed&&!a.offbudget),'Account unavailable');
  if(rappi){const account=snapshot.accounts.find(a=>a.id===leg.account);assert.equal(account.name,currency==='clp'?'Rappi Card':'RappiCard USD','RappiCard account mismatch');assert(leg.sourceId.startsWith('bank:rappicard:fx:'),'RappiCard source mismatch')}
  const cat=snapshot.categories.find(c=>c.id===leg.category);assert(cat&&!cat.hidden&&(currency==='clp'?cat.is_income===false&&cat.name==='Salida CLP':cat.is_income===true&&cat.name==='Transferencias entre monedas / Entrada USD'),'Wrong transfer category');
 }
 assert.notEqual(p.clp.sourceId,p.usd.sourceId,'Source identities must differ');
 const audit=ledger.crossCurrencyDebtTransfers?.[p.reference];if(audit?.status==='pending')throw Error('Pending cross-currency transfer requires investigation');
 if(audit){assert.equal(audit.status,'complete','Invalid audit status');eq(audit.candidate,p,'Audit candidate differs');for(const [currency,leg] of [['clp',p.clp],['usd',p.usd]]){const matching=s[currency].transactions.filter(t=>t.imported_id===leg.sourceId);assert.equal(matching.length,1,'Completed leg missing/duplicated');assert(transactionMatches(matching[0],leg,p),'Completed leg changed');assert.equal(matching[0].id,audit.ids[currency],'Completed leg id changed')}return{action:'existing',ids:audit.ids}}
 for(const [currency,leg] of [['clp',p.clp],['usd',p.usd]]){const ts=s[currency].transactions;assert(!ts.some(t=>t.imported_id===leg.sourceId||String(t.notes??'').includes(p.reference)),'Duplicate source or reference');assert(!ts.some(t=>t.account===leg.account&&t.amount===leg.amount&&Math.abs(Date.parse(t.date+'T12:00:00Z')-Date.parse(p.date+'T12:00:00Z'))<=4*86400000),'Possible duplicate on account')}
 return{action:'create',reference:p.reference,clp:p.clp.amount,usd:p.usd.amount};
}
async function withBudget(d,currency,fn){const {api}=await d.connect((d.budgets??BUDGETS)[currency].syncId);try{return await fn(api)}finally{await api.shutdown()}}
async function snapshots(d){let out={};for(const currency of ['CLP','USD'])out[currency.toLowerCase()]=await withBudget(d,currency,api=>d.snapshot(api));return out}
function verifyNew(before,after,p,currency){
 const leg=p[currency],found=after.transactions.filter(t=>t.imported_id===leg.sourceId);assert.equal(found.length,1,'New source missing or duplicated');const t=found[0];assert(transactionMatches(t,leg,p),'New leg differs');
 assert.equal(after.transactions.length,before.transactions.length+1,'Transaction count changed');const byId=new Map(after.transactions.map(t=>[t.id,t]));assert.equal(byId.size,after.transactions.length,'Duplicate ids');for(const old of before.transactions)eq(byId.get(old.id),old,'Other transaction changed');
 for(const k of Object.keys(before).filter(k=>!['transactions','balances'].includes(k)))eq(after[k],before[k],`Unrelated ${k} changed`);
 const balances=structuredClone(before.balances);balances[leg.account]+=leg.amount;eq(after.balances,balances,'Unexpected balances');return t.id;
}
export async function recordCrossCurrencyDebt(p,commit,d){
 let ledger=commit?await d.requireRun():await d.readState();if(ledger.crossCurrencyDebtTransfers?.[p.reference]?.status==='pending')throw Error('Pending cross-currency transfer requires investigation');
 const before=await snapshots(d),action=classifyCrossCurrencyDebt(p,before,ledger);if(!commit)return {...action,candidate:p};if(action.action==='existing')return {...action,verified:true,backups:ledger.crossCurrencyDebtTransfers[p.reference].backups};
 const backups={};for(const currency of ['CLP','USD'])backups[currency.toLowerCase()]=await withBudget(d,currency,async api=>{const current=await d.snapshot(api);eq(current,before[currency.toLowerCase()],'Budget changed before backup');const dir=await d.backup(api,currency,current);await d.json(dir+'/cross-currency-debt.json',{candidate:p});return dir});
 eq(await snapshots(d),before,'Budget changed before cross-currency write');ledger=await d.requireRun();classifyCrossCurrencyDebt(p,before,ledger);ledger.crossCurrencyDebtTransfers??={};ledger.crossCurrencyDebtTransfers[p.reference]={status:'pending',candidate:p,backups};await d.save(ledger);
 for(const currency of ['CLP','USD'])await withBudget(d,currency,async api=>{const k=currency.toLowerCase(),leg=p[k],fresh=await d.snapshot(api);eq(fresh,before[k],`${currency} budget changed before write`);await d.requireRun();await api.addTransactions(leg.account,[{date:p.date,amount:leg.amount,category:leg.category,payee:null,imported_id:leg.sourceId,notes:note(p),cleared:false}],{runTransfers:false,learnCategories:false});await api.sync()});
 const after=await snapshots(d),ids={};for(const k of ['clp','usd']){ids[k]=verifyNew(before[k],after[k],p,k);await d.json(backups[k]+'/after.json',after[k])}
 ledger=await d.requireRun();const audit=ledger.crossCurrencyDebtTransfers?.[p.reference];assert.equal(audit?.status,'pending');eq(audit.candidate,p,'Pending audit changed');audit.ids=ids;audit.status='complete';audit.verifiedAt=new Date().toISOString();await d.save(ledger);assert.equal(classifyCrossCurrencyDebt(p,after,ledger).action,'existing');return{...action,ids,backups,verified:true};
}
