import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BUDGETS} from './actual-daily-policy.mjs';
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
export function recoverStates(original,live,p){
 const parent=original.transactions.find(t=>t.id===p.oldParent.id);eq(parent,p.oldParent,'Backup parent does not match incident candidate');
 const child=parent.subtransactions.find(c=>c.id===p.childId);assert(child&&child.amount<0&&child.category&&child.notes.split(p.oldText).length===2);assert.equal(parent.subtransactions.reduce((n,c)=>n+c.amount,0),parent.amount);
 const damaged=structuredClone(original), t=damaged.transactions.find(t=>t.id===parent.id), c=t.subtransactions.find(c=>c.id===p.childId);
 c.amount=0;c.category=null;c.sort_order=parent.sort_order;c.notes=c.notes.replace(p.oldText,p.newText);t.error={type:'SplitTransactionError',version:1,difference:child.amount};damaged.balances[parent.account]-=child.amount;
 eq(live,damaged,'Live state differs from known corruption; recovery blocked');
 const expected=structuredClone(original), restored=expected.transactions.find(t=>t.id===parent.id);restored.subtransactions.find(c=>c.id===p.childId).notes=c.notes;
 return {expected,restored,correction:child.amount};
}
export async function recoverSplitIncident(c,commit,d){
 assert.equal(c.splitIncidentRecovery,true);assert.equal(c.currency,'CLP');assert(/^\/Users\/birrein\/Actual-pilot\/daily\/backups\/\d+-CLP$/.test(c.backup));
 const original=await read(c.backup+'/before.json'),p=(await read(c.backup+'/split-child-note.json')).candidate;assert.equal(p.currency,c.currency);assert.equal(p.splitChildNoteAmendment,true);
 let lease=commit?await d.requireRun():await d.readState();for(const id of p.oldRecord.sourceIds)eq(lease.records[id],p.oldRecord,'Ledger changed');
 let {api}=await d.connect(BUDGETS[c.currency].syncId),live,target,dir;
 try{live=await d.snapshot(api);target=recoverStates(original,live,p);if(!commit)return {action:'restore-parent',parent:p.oldParent.id,child:p.childId,balanceCorrection:target.correction,preIncidentBackup:c.backup};
 dir=await d.backup(api,c.currency,live);await d.json(dir+'/split-incident-recovery.json',{candidate:c,incident:p});await api.sync();eq(await d.snapshot(api),live,'Budget changed');lease=await d.requireRun();for(const id of p.oldRecord.sourceIds)eq(lease.records[id],p.oldRecord,'Ledger changed');
 const t=target.restored;await api.updateTransaction(t.id,{amount:t.amount,payee:t.payee,notes:t.notes,subtransactions:t.subtransactions});await api.sync();
 }finally{await api.shutdown()}
 ({api}=await d.connect(BUDGETS[c.currency].syncId));try{const after=await d.snapshot(api);eq(after,target.expected,'Recovery readback differs from pre-incident budget');await d.json(dir+'/after.json',after);lease=await d.requireRun();for(const id of p.oldRecord.sourceIds)eq(lease.records[id],p.oldRecord,'Ledger changed');lease.splitIncidentRecoveries??={};lease.splitIncidentRecoveries[p.childId]={parent:p.oldParent.id,preIncidentBackup:c.backup,recoveryBackup:dir,verifiedAt:new Date().toISOString()};await d.save(lease);return{action:'restored-parent',parent:p.oldParent.id,child:p.childId,balanceCorrection:target.correction,verified:true,backup:dir};}finally{await api.shutdown()}
}
