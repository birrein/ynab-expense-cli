import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

export function classifyHistoricalCategory(p,s,ledger){
 const allowed=new Set(['transactionHistoricalCategoryAmendment','currency','transactionId','account','payeeId','date','amount','oldCategory','newCategory','importedId','oldNotes','evidence']);
 assert.equal(p.transactionHistoricalCategoryAmendment,true,'Historical category operation required');
 for(const k of Object.keys(p))assert(allowed.has(k),`Unexpected field ${k}`);
 assert(Object.hasOwn(BUDGETS,p.currency),'Only CLP/USD supported');
 for(const k of ['transactionId','account','date','oldCategory','newCategory','evidence'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 for(const k of ['payeeId','importedId','oldNotes'])assert(Object.hasOwn(p,k)&&(p[k]===null||typeof p[k]==='string'),`Missing or invalid ${k}`);
 assert(p.importedId===null||! /^(gmail|manual):/i.test(p.importedId),'Source-ledger imports unsupported');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!Number.isNaN(Date.parse(p.date))&&new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)===p.date,'Invalid date');
 assert(Number.isSafeInteger(p.amount)&&p.amount<0,'Expected expense amount');assert.notEqual(p.oldCategory,p.newCategory,'Category unchanged');
 const ts=s.transactions.filter(t=>t.id===p.transactionId);assert.equal(ts.length,1,'Transaction is not unique');const t=ts[0];
 assert(!t.is_parent&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.subtransactions?.length,'Only simple non-transfer expenses are supported');
 for(const [field,key] of [['account','account'],['payee','payeeId'],['date','date'],['amount','amount'],['imported_id','importedId'],['notes','oldNotes']])assert.deepEqual(t[field]??null,p[key],`Identity mismatch ${field}`);
 assert(t.category===p.oldCategory||t.category===p.newCategory,'Category differs from expected');
 assert(s.accounts.some(a=>a.id===p.account&&!a.closed&&!a.offbudget),'Account unavailable');
 assert(s.categories.some(c=>c.id===p.oldCategory),'Old category missing');
 assert(s.categories.some(c=>c.id===p.newCategory&&!c.hidden&&!c.is_income),'Target category unavailable');
 if(p.payeeId!==null)assert(s.payees.some(x=>x.id===p.payeeId&&!x.transfer_acct),'Payee unavailable');
 assert(!Object.values(ledger.records??{}).some(r=>r.transactionId===p.transactionId),'Transaction belongs to source ledger');
 return {action:t.category===p.newCategory?'existing':'amend-category',id:p.transactionId,oldCategory:p.oldCategory,newCategory:p.newCategory};
}
export async function amendHistoricalCategory(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Only CLP/USD supported');
 let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir=null;
 try{before=await d.snapshot(api);action=classifyHistoricalCategory(p,before,ledger);if(!commit)return {...action,candidate:p};
  if(action.action!=='existing'){
   dir=await d.backup(api,p.currency,before);await d.json(dir+'/historical-category-amendment.json',{candidate:p});
   await api.sync();const latest=await d.snapshot(api);assert.deepEqual(latest,before,'Budget changed before category amendment');
   classifyHistoricalCategory(p,latest,await d.requireRun());await api.updateTransaction(p.transactionId,{category:p.newCategory});await api.sync();
  }
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{const after=await d.snapshot(api),lease=await d.requireRun();assert.equal(classifyHistoricalCategory(p,after,lease).action,'existing','Category readback mismatch');
  const expected={...before,transactions:before.transactions.map(t=>t.id===p.transactionId?{...t,category:p.newCategory}:t)};assert.deepEqual(after,expected,'Unrelated budget changed');
  if(dir)await d.json(dir+'/after.json',after);
  lease.historicalCategoryAmendments??={};const h=lease.historicalCategoryAmendments[p.transactionId]??=[];
  if(!h.some(x=>x.oldCategory===p.oldCategory&&x.newCategory===p.newCategory))h.push({oldCategory:p.oldCategory,newCategory:p.newCategory,evidence:p.evidence,verifiedAt:new Date().toISOString(),backup:dir,recovered:!dir});
  lease.historicalCategoryAmendments[p.transactionId]=h;await d.save(lease);
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
