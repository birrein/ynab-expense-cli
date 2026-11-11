import assert from 'node:assert/strict';

export function classifyAccountRename(c,s,ledger){
 const allowed=['accountRename','currency','account','oldName','newName','evidence'];
 assert(c&&c.accountRename===true&&Object.keys(c).every(k=>allowed.includes(k)),'Invalid rename candidate');
 assert(['CLP','USD'].includes(c.currency),'Unsupported budget');
 for(const k of ['account','oldName','newName','evidence'])assert(typeof c[k]==='string'&&c[k].trim()===c[k]&&c[k].length>0,'Missing '+k);
 assert(c.oldName!==c.newName,'Names must differ');
 const targets=s.accounts.filter(a=>a.id===c.account);assert.equal(targets.length,1,'Account not unique');
 const target=targets[0];assert(!target.closed&&!target.offbudget,'Account unavailable');
 assert(!s.accounts.some(a=>a.id!==c.account&&a.name.toLocaleLowerCase()===c.newName.toLocaleLowerCase()),'Account name already exists');
 const payees=s.payees.filter(p=>p.transfer_acct===c.account);assert.equal(payees.length,1,'Transfer payee not unique');
 const key=c.currency+':'+c.account;
 if(target.name===c.newName){const audit=ledger.accountRenames?.[key];assert(audit&&JSON.stringify(audit.candidate)===JSON.stringify(c),'Renamed account lacks matching audit');return {action:'existing',id:c.account};}
 assert.equal(target.name,c.oldName,'Account name changed');
 assert.equal(payees[0].name,c.oldName,'Transfer payee name differs');
 return {action:'rename',id:c.account,oldName:c.oldName,newName:c.newName,transactionCount:s.transactions.filter(t=>t.account===c.account).length,balance:s.balances[c.account],transferPayeeId:payees[0].id};
}

export async function renameAccount(c,commit,ctx){
 assert(Object.hasOwn(ctx.budgets,c.currency),'Unsupported budget');
 let ledger=commit?await ctx.requireRun():await ctx.readState();
 let {api}=await ctx.connect(ctx.budgets[c.currency].syncId),before,plan,dir;
 try{
  before=await ctx.snapshot(api);plan=classifyAccountRename(c,before,ledger);
  if(!commit)return {...plan,candidate:c};
  if(plan.action==='existing')return {...plan,verified:true,backup:ledger.accountRenames[c.currency+':'+c.account].backup};
  dir=await ctx.backup(api,c.currency,before);await ctx.json(dir+'/account-rename.json',{candidate:c});
  await api.sync();ctx.equal(await ctx.snapshot(api),before,'Budget changed before account rename');
  classifyAccountRename(c,before,await ctx.requireRun());
  await api.updateAccount(c.account,{name:c.newName});await api.sync();
 }finally{await api.shutdown();}
 ({api}=await ctx.connect(ctx.budgets[c.currency].syncId));
 try{
  const after=await ctx.snapshot(api),byId=(items)=>new Map(items.map(x=>[x.id,x]));
  for(const key of ['accounts','payees']){
   const actual=byId(after[key]);assert.equal(actual.size,before[key].length,'Unexpected '+key+' count');
   for(const original of before[key]){
    const found=actual.get(original.id);assert(found,'Missing '+key+' record');
    let expected=original;
    if(key==='accounts'&&original.id===c.account)expected={...original,name:c.newName};
    if(key==='payees'&&original.transfer_acct===c.account){assert([c.oldName,c.newName].includes(found.name),'Unexpected transfer payee name');expected={...original,name:found.name};}
    ctx.equal(found,expected,'Unexpected '+key+' change');
   }
  }
  for(const key of ['transactions','categories','rules','schedules','balances'])ctx.equal(after[key],before[key],'Unexpected '+key+' change');
  await ctx.json(dir+'/after.json',after);ledger=await ctx.requireRun();ledger.accountRenames??={};ledger.accountRenames[c.currency+':'+c.account]={candidate:c,backup:dir,verifiedAt:new Date().toISOString()};await ctx.save(ledger);
  return {action:'rename',id:c.account,oldName:c.oldName,newName:c.newName,verified:true,backup:dir,transferPayeeName:after.payees.find(p=>p.transfer_acct===c.account).name};
 }finally{await api.shutdown();}
}
