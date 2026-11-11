import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';
import { noteTagTokens } from './actual-note-tags.mjs';

export function classifyHistoricalTag(p,s,ledger){
 const allowed=new Set(['transactionHistoricalTagAmendment','currency','transactionId','account','payeeId','date','amount','category','importedId','oldNotes','tag','evidence']);
 assert.equal(p.transactionHistoricalTagAmendment,true,'Historical tag operation required');
 for(const k of Object.keys(p))assert(allowed.has(k),`Unexpected field ${k}`);
 assert(Object.hasOwn(BUDGETS,p.currency),'Only CLP/USD supported');
 for(const k of ['transactionId','account','payeeId','date','category','oldNotes','tag','evidence'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!Number.isNaN(Date.parse(p.date))&&new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)===p.date,'Invalid date');
 assert(Number.isSafeInteger(p.amount)&&p.amount<0,'Expected expense amount');
 assert(Object.hasOwn(p,'importedId')&&(p.importedId===null||typeof p.importedId==='string'&&!/^(gmail|manual):/i.test(p.importedId)),'Invalid historical imported ID');
 assert(/^#[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(p.tag),'Invalid tag');
 const count=noteTagTokens(p.oldNotes).filter(x=>x.tag.toLowerCase()===p.tag.toLowerCase()).length;
 assert(count<=1,'Duplicate tag');
 const newNotes=count?p.oldNotes:p.tag+'\n'+p.oldNotes;
 const ts=s.transactions.filter(t=>t.id===p.transactionId);assert.equal(ts.length,1,'Historical transaction not unique');const t=ts[0];
 assert(!t.is_parent&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.subtransactions?.length,'Expected simple non-transfer expense');
 for(const [field,key] of [['account','account'],['payee','payeeId'],['date','date'],['amount','amount'],['category','category'],['imported_id','importedId']])assert.equal(t[field]??null,p[key],`Identity mismatch ${field}`);
 assert(s.accounts.some(a=>a.id===p.account&&!a.closed&&!a.offbudget),'Account unavailable');
 assert(s.categories.some(c=>c.id===p.category&&!c.hidden),'Category unavailable');
 assert(s.payees.some(a=>a.id===p.payeeId&&!a.transfer_acct),'Payee unavailable');
 assert(!Object.values(ledger.records??{}).some(r=>r.transactionId===p.transactionId),'Transaction belongs to source ledger');
 assert(t.notes===p.oldNotes||t.notes===newNotes,'Notes changed since preview');
 return {action:t.notes===newNotes?'existing':'add-historical-tag',id:p.transactionId,oldNotes:p.oldNotes,newNotes,tag:p.tag};
}
export async function amendHistoricalTag(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Only CLP/USD supported');
 let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency]?.syncId),before,action,dir=null;
 try{before=await d.snapshot(api);action=classifyHistoricalTag(p,before,ledger);if(!commit)return {...action,candidate:p};
  if(action.action!=='existing'){
   dir=await d.backup(api,p.currency,before);await d.json(dir+'/historical-tag-amendment.json',{candidate:p,newNotes:action.newNotes});
   await api.sync();assert.deepEqual(await d.snapshot(api),before,'Budget changed before historical amendment');
   classifyHistoricalTag(p,before,await d.requireRun());await api.updateTransaction(p.transactionId,{notes:action.newNotes});await api.sync();
  }
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{let after=await d.snapshot(api),lease=await d.requireRun();assert.equal(classifyHistoricalTag(p,after,lease).action,'existing','Readback mismatch');
  let expected={...before,transactions:before.transactions.map(t=>t.id===p.transactionId?{...t,notes:action.newNotes}:t)};assert.deepEqual(after,expected,'Unrelated budget changed');
  if(dir)await d.json(dir+'/after.json',after);
  if(p.oldNotes!==action.newNotes){lease.historicalTagAmendments??={};let h=lease.historicalTagAmendments[p.transactionId]??=[];if(!h.some(x=>x.oldNotes===p.oldNotes&&x.newNotes===action.newNotes))h.push({oldNotes:p.oldNotes,newNotes:action.newNotes,tag:p.tag,evidence:p.evidence,verifiedAt:new Date().toISOString(),backup:dir,recovered:!dir});lease.historicalTagAmendments[p.transactionId]=h;await d.save(lease);}
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
