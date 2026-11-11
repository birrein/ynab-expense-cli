import assert from 'node:assert/strict';import {readdir,readFile} from 'node:fs/promises';
const review=reason=>({action:'review',reason});
export function classifyRebalance(c,s,recovery=false){
 const permitted=new Set(['seriesRebalance','currency','account','payee','category','originalTotal','sourceId','sourceIds','series','evidence']);
 if(Object.keys(c).some(k=>!permitted.has(k)))return review('Conflicting operation fields');
 for(const k of ['currency','account','payee','category','sourceId','evidence'])if(typeof c[k]!=='string'||!c[k].trim())return review('Missing '+k);
 if(!['CLP','USD'].includes(c.currency)||!Array.isArray(c.sourceIds)||!c.sourceIds.includes(c.sourceId)||!Array.isArray(c.series)||c.series.length<2)return review('Invalid series provenance');
 if(!Number.isSafeInteger(c.originalTotal)||c.originalTotal>=0)return review('Invalid total');
 const ids=new Set(),rules=new Set(),nums=new Set();let old=0,newTotal=0,changed=0,partial=false;
 for(const x of c.series){
  if(!Number.isInteger(x.number)||x.number<1||x.number>c.series.length||nums.has(x.number)||ids.has(x.scheduleId)||rules.has(x.ruleId))return review('Duplicate series identity');
  nums.add(x.number);ids.add(x.scheduleId);rules.add(x.ruleId);
  if(!Number.isSafeInteger(x.oldAmount)||x.oldAmount>=0||!Number.isSafeInteger(x.newAmount)||x.newAmount>=0||![x.scheduleId,x.ruleId,x.date,x.oldName,x.newName].every(v=>typeof v==='string'&&v.trim()))return review('Invalid series entry');
  old+=x.oldAmount;newTotal+=x.newAmount;if(x.oldAmount!==x.newAmount)changed++;
  const sc=s.schedules.find(z=>z.id===x.scheduleId),rule=s.rules.find(z=>z.id===x.ruleId);
  if(!sc||!rule||sc.account!==c.account||sc.payee!==c.payee||sc.rule!==x.ruleId||sc.date!==x.date||sc.next_date!==x.date||sc.completed||sc.posts_transaction!==false||s.transactions.some(t=>t.schedule===x.scheduleId))return review('Series identity, completion or posting mismatch');
  const condition=rule.conditions?.filter(z=>z.field==='amount');
  if(condition?.length!==1||!rule.actions?.some(z=>z.op==='link-schedule'&&z.value===x.scheduleId)||!rule.actions?.some(z=>z.op==='set'&&z.field==='category'&&z.value===c.category))return review('Series rule mismatch');
  const scheduleOld=sc.amount===x.oldAmount&&sc.name===x.oldName,scheduleNew=sc.amount===x.newAmount&&sc.name===x.newName;
  const ruleOld=condition[0].value===x.oldAmount,ruleNew=condition[0].value===x.newAmount;
  if((!scheduleOld&&!scheduleNew)||(!ruleOld&&!ruleNew))return review('Unexpected amount or name');
  if(!scheduleOld||!ruleOld)partial=true;
 }
 if(old!==c.originalTotal||newTotal!==c.originalTotal||changed<2)return review('Series does not preserve purchase total');
 if(partial&&!recovery)return review('Partial changes require the exact backed-up candidate');
 return {action:partial?'recover':'edit'};
}
export async function rebalanceSeries(c,commit,ctx){
 const {connect,snapshot,backup,requireRun,save,json,equal}=ctx;assert(ctx.budgets[c.currency],'Unsupported budget');let lease=commit?await requireRun():null;
 let {api}=await connect(ctx.budgets[c.currency].syncId),before,original,dir,action;
 try{
  before=await snapshot(api);let originalDir=null;
  if(commit){lease=await requireRun();for(const id of c.sourceIds){const rec=lease.records[id];assert(rec,'Missing source ledger');assert.equal(rec.amount,c.originalTotal);assert.equal(rec.account,c.account);assert.equal(rec.category,c.category);equal(rec.sourceIds,c.sourceIds,'Ledger sources mismatch');equal(rec.scheduleIds,c.series.map(x=>x.scheduleId),'Ledger schedules mismatch');equal(rec.ruleIds,c.series.map(x=>x.ruleId),'Ledger rules mismatch');}}
  action=classifyRebalance(c,before);
  if(action.action==='review'&&action.reason==='Partial changes require the exact backed-up candidate'&&ctx.root){
   for(const e of (await readdir(ctx.root+'/backups')).sort().reverse()){
    const p=ctx.root+'/backups/'+e;try{const saved=JSON.parse(await readFile(p+'/series-rebalance.json','utf8'));if(JSON.stringify(saved)===JSON.stringify(c)){original=JSON.parse(await readFile(p+'/before.json','utf8'));originalDir=p;break}}catch(err){if(err.code!=='ENOENT')throw err}
   }
   if(originalDir){assert.equal(classifyRebalance(c,original).action,'edit','Recovery backup is invalid');action=classifyRebalance(c,before,true)}
  }
  if(action.action==='review'||!commit)return {...action,candidate:c};
  if(originalDir)dir=originalDir;else {original=before;dir=await backup(api,c.currency,before);await json(dir+'/series-rebalance.json',c)}
  for(const x of c.series){
   if(x.oldAmount===x.newAmount)continue;
   const sc=before.schedules.find(z=>z.id===x.scheduleId),rule=before.rules.find(z=>z.id===x.ruleId);
   if(sc.amount!==x.newAmount||sc.name!==x.newName)await api.updateSchedule(x.scheduleId,{name:x.newName,amount:x.newAmount},false);
   if(rule.conditions.find(z=>z.field==='amount').value!==x.newAmount)await api.updateRule({...rule,conditions:rule.conditions.map(z=>z.field==='amount'?{...z,value:x.newAmount}:z)});
  }
  await api.sync();
 }finally{await api.shutdown()}
 ({api}=await connect(ctx.budgets[c.currency].syncId));
 try{
  const after=await snapshot(api);assert.equal(after.transactions.length,original.transactions.length);for(const t of original.transactions)equal(after.transactions.find(x=>x.id===t.id),t,'Transaction changed');
  for(const k of ['accounts','categories','payees','balances'])equal(after[k],original[k],'Unexpected '+k+' change');
  assert.equal(after.schedules.length,original.schedules.length);assert.equal(after.rules.length,original.rules.length);
  for(const sc of original.schedules){const item=c.series.find(x=>x.scheduleId===sc.id),live=after.schedules.find(x=>x.id===sc.id);assert(live);equal(live,item?{...sc,name:item.newName,amount:item.newAmount}:sc,'Unexpected schedule change')}
  for(const rule of original.rules){const item=c.series.find(x=>x.ruleId===rule.id),live=after.rules.find(x=>x.id===rule.id);assert(live);const expected=item?{...rule,conditions:rule.conditions.map(z=>z.field==='amount'?{...z,value:item.newAmount}:z)}:rule;equal(live,expected,'Unexpected rule change')}
  await json(dir+'/after.json',after);lease=await requireRun();lease.seriesRebalances??={};lease.seriesRebalances[c.sourceId]={scheduleIds:c.series.map(x=>x.scheduleId),oldAmounts:c.series.map(x=>x.oldAmount),newAmounts:c.series.map(x=>x.newAmount),total:c.originalTotal,evidence:c.evidence,backup:dir,verifiedAt:new Date().toISOString()};await save(lease);
  return {action:action.action,verified:true,backup:dir,total:c.originalTotal};
 }finally{await api.shutdown()}
}
