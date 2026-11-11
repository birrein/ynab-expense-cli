import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';

const review=reason=>({action:'review',reason});
const postingNotes=c=>`${c.notes||''}\nFuente cartola: https://mail.google.com/mail/u/0/#all/${c.statementMessageId}\nReferencia: ${c.sourceId}`.trim();
export function classifyPosting(c,s){
 const conflicting=['transactionResolvedNotesAmendment','transactionHistoricalTagAmendment','transactionNotesAmendment','transactionTagAmendment','transactionTagsPrefixAmendment','transactionNotesLineRepair','scheduleNotesAmendment','scheduleAmendment','remainingInstallments','remainingInstallment','installments','resolveId','splits','refundOf'];
 if(conflicting.some(k=>Object.hasOwn(c,k)))return review('Conflicting operation');
 for(const key of ['currency','account','scheduleId','ruleId','payee','date','category','sourceId','statementMessageId','evidence']) if(typeof c[key]!=='string'||!c[key].trim())return review('Missing '+key);
 if(c.currency!=='CLP'&&c.currency!=='USD')return review('Unsupported currency');
 if(!/^statement:[A-Za-z0-9:_-]+$/.test(c.sourceId)||!/^[a-f0-9]+$/.test(c.statementMessageId)||!Number.isSafeInteger(c.amount)||c.amount>=0||c.billedAmount!==c.amount)return review('Billed amount or source mismatch');
 if(!s.accounts.some(x=>x.id===c.account&&!x.closed&&!x.offbudget)||!s.categories.some(x=>x.id===c.category&&!x.hidden))return review('Account or category unavailable');
 const sch=s.schedules.find(x=>x.id===c.scheduleId),rule=s.rules.find(x=>x.id===c.ruleId);
 if(!sch||sch.rule!==c.ruleId||sch.account!==c.account||sch.payee!==c.payee||sch.date!==c.date||sch.next_date!==c.date||sch.amount!==c.amount||sch.posts_transaction!==false)return review('Schedule identity mismatch');
 if(!rule||!rule.actions?.some(a=>a.op==='set'&&a.field==='category'&&a.value===c.category)||!rule.actions?.some(a=>a.op==='link-schedule'&&a.value===c.scheduleId))return review('Rule or category mismatch');
 const same=s.transactions.filter(t=>t.imported_id===c.sourceId||t.schedule===c.scheduleId);
 if(same.length){
  if(same.length!==1)return review('Multiple linked or sourced transactions');
  const t=same[0];
  if(t.imported_id!==c.sourceId||t.account!==c.account||t.payee!==c.payee||t.date!==c.date||t.amount!==c.amount||t.category!==c.category||t.is_parent||t.is_child||t.transfer_id)return review('Existing transaction conflicts');
  const ruleNotes=rule.actions.find(a=>a.op==='set'&&a.field==='notes')?.value;
  if(t.notes!==postingNotes(c)&&!(typeof ruleNotes==='string'&&t.notes===ruleNotes))return review('Existing transaction notes conflict');
  if(t.schedule===c.scheduleId&&t.notes===postingNotes(c))return {action:'existing',id:t.id};
  if((!t.schedule||t.schedule===c.scheduleId)&&!sch.completed)return {action:'recover-link',id:t.id};
  return review('Existing transaction schedule conflicts');
 }
 if(sch.completed)return review('Schedule already completed');
 const d=Date.parse(c.date+'T00:00:00Z');
 if(!Number.isFinite(d))return review('Invalid date');
 if(s.transactions.some(t=>t.account===c.account&&t.amount===c.amount&&Math.abs(Date.parse(t.date+'T00:00:00Z')-d)<=3*86400000))return review('Possible duplicate in account');
 return {action:'create'};
}
export async function postInstallment(c,commit,ctx){
 const {connect,snapshot,backup,requireRun,readState,save,json,equal}=ctx;
 assert(ctx.budgets[c.currency],'Only configured CLP/USD budgets are supported');
 let lease=commit?await requireRun():null,{api}=await connect(ctx.budgets[c.currency]?.syncId),before,action,dir,id;
 try{
  before=await snapshot(api);action=classifyPosting(c,before);
  if(action.action==='review'||!commit)return {...action,candidate:c};
  if(action.action==='existing')id=action.id;
  else {
   dir=await backup(api,c.currency,before);
   await json(dir+'/installment-posting.json',c);
   if(action.action==='create'){
    const notes=postingNotes(c);
    await api.addTransactions(c.account,[{date:c.date,amount:c.amount,payee:c.payee,category:c.category,imported_id:c.sourceId,notes,cleared:false}],{runTransfers:false,learnCategories:false});
    const created=(await api.getTransactions(c.account,c.date,c.date)).filter(t=>t.imported_id===c.sourceId);assert.equal(created.length,1,'Expected exactly one source transaction');id=created[0].id;
   }else id=action.id;
   const t=(await api.getTransactions(c.account,c.date,c.date)).find(x=>x.id===id);
   if(t.schedule!==c.scheduleId||t.notes!==postingNotes(c))await api.updateTransaction(id,{schedule:c.scheduleId,notes:postingNotes(c)});
   await api.sync();
  }
 }finally{await api.shutdown();}
 ({api}=await connect(ctx.budgets[c.currency].syncId));
 try{
  const after=await snapshot(api),result=classifyPosting(c,after);assert.equal(result.action,'existing','Independent posting verification failed');assert.equal(result.id,id);
  for(const key of ['accounts','categories','rules'])equal(after[key],before[key],'Unexpected change '+key);
  assert.equal(after.schedules.length,before.schedules.length,'Unexpected schedule count');
  const schedulesAfter=new Map(after.schedules.map(x=>[x.id,x]));
  for(const original of before.schedules){
   const current=schedulesAfter.get(original.id);assert(current,'Schedule missing after posting');
   if(original.id!==c.scheduleId)equal(current,original,'Unrelated schedule changed');
   else {const old={...original},fresh={...current};delete old.completed;delete fresh.completed;equal(fresh,old,'Target schedule changed beyond completion');assert(current.completed===original.completed||current.completed===true,'Unexpected schedule completion');}
  }
  const map=new Map(after.transactions.map(t=>[t.id,t]));for(const t of before.transactions)if(t.id!==id)equal(map.get(t.id),t,'Unrelated transaction changed');
  assert.equal(after.transactions.length,before.transactions.length+(action.action==='create'?1:0));
  for(const [aid,balance] of Object.entries(before.balances))assert.equal(after.balances[aid],balance+(action.action==='create'&&aid===c.account?c.amount:0),'Balance mismatch');
  if(dir)await json(dir+'/after.json',after);
  lease=await requireRun();lease.installmentPostings??={};const previous=lease.installmentPostings[c.sourceId];
  if(action.action==='existing'&&!previous&&ctx.root){
   const base=ctx.root+'/backups';let recovered=null;
   for(const entry of (await readdir(base)).sort().reverse()){
    const path=base+'/'+entry;
    try{const saved=JSON.parse(await readFile(path+'/installment-posting.json','utf8'));if(JSON.stringify(saved)!==JSON.stringify(c))continue;
     const old=JSON.parse(await readFile(path+'/before.json','utf8'));assert(!old.transactions.some(t=>t.imported_id===c.sourceId||t.schedule===c.scheduleId),'Recovery backup already contained target');
     assert.equal(after.transactions.length,old.transactions.length+1,'Recovery transaction count differs');
     const indexed=new Map(after.transactions.map(t=>[t.id,t]));for(const t of old.transactions)equal(indexed.get(t.id),t,'Recovery found unrelated transaction change');
     for(const [aid,balance] of Object.entries(old.balances))assert.equal(after.balances[aid],balance+(aid===c.account?c.amount:0),'Recovery balance differs');
     for(const k of ['accounts','categories','rules'])equal(after[k],old[k],'Recovery found unrelated '+k+' change');
     const now=new Map(after.schedules.map(x=>[x.id,x]));assert.equal(now.size,old.schedules.length);for(const sc of old.schedules){const live=now.get(sc.id);assert(live);if(sc.id!==c.scheduleId)equal(live,sc,'Recovery found unrelated schedule change');else {const a={...sc},b={...live};delete a.completed;delete b.completed;equal(a,b,'Recovery target schedule changed');}}
     recovered=path;break;
    }catch(e){if(e.code==='ENOENT')continue;throw e;}
   }
   assert(recovered,'No matching verified backup found for existing unaudited posting');dir=recovered;await json(dir+'/after.json',after);
  }
  lease.installmentPostings[c.sourceId]={transactionId:id,scheduleId:c.scheduleId,currency:c.currency,account:c.account,date:c.date,amount:c.amount,category:c.category,statementMessageId:c.statementMessageId,evidence:c.evidence,backup:dir??previous?.backup??null,verifiedAt:new Date().toISOString()};await save(lease);
  return {action:action.action,id,scheduleId:c.scheduleId,verified:true,backup:dir??null};
 }finally{await api.shutdown();}
}
