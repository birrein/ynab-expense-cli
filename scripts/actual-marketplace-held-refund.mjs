import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';

const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const sourceOK=s=>typeof s==='string'&&/^bank:[A-Za-z0-9:_-]+$/.test(s);
const fileOK=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(s);
const textOK=s=>typeof s==='string'&&s.trim().length>=30&&!/[\r\n]/.test(s);
const day=s=>Date.parse(s+'T00:00:00Z')/86400000;
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const keys=(o,k)=>eq(Object.keys(o).sort(),k.sort(),'Unexpected fields');
const newSources=p=>[p.sale.sourceId,p.hold.sourceId,p.hold.releaseSourceId,...p.settlements.map(x=>x.sourceId)];

export function heldRefundSourceConflict(candidate,ledger){
 const text=JSON.stringify(candidate);
 return Object.values(ledger.marketplaceHeldRefunds??{}).some(a=>['pending','complete'].includes(a?.status)&&a.candidate&&((a.status==='pending'&&text.includes(a.candidate.wallet))||newSources(a.candidate).some(s=>text.includes(s))));
}

const isTargetWidget=w=>['cash-flow-card','spending-card'].includes(w.type)||(w.type==='summary-card'&&(w.meta?.conditions??[]).some(c=>c.field==='amount'&&['gt','lt'].includes(c.op)));
function widgetPlan(widgets){assert(Array.isArray(widgets),'Dashboard inspection required');assert.equal(new Set(widgets.map(w=>w.id)).size,widgets.length,'Duplicate dashboard identity');for(const w of widgets.filter(isTargetWidget))assert(!w.meta?.conditions?.length||!w.meta.conditionsOp||w.meta.conditionsOp==='and','Unsupported dashboard filter composition');return widgets.filter(isTargetWidget).map(w=>w.id).sort();}
const withExclusion=(w,id)=>({...w,meta:{...w.meta,conditionsOp:'and',conditions:[...(w.meta?.conditions??[]),{field:'category',op:'isNot',value:id,type:'id'}]}});
export function classifyHeldRefund(p,s,l,widgets){
 keys(p,['marketplaceHeldRefund','currency','wallet','holdingName','incomeCategoryName','incomeGroup','payee','reference','reportId','claimFileId','statementIds','fees','sale','hold','settlements','checks','evidence','reportingEvidence']);
 assert.equal(p.marketplaceHeldRefund,true);assert(BUDGETS[p.currency],'Unsupported currency');
 assert(typeof p.wallet==='string'&&s.accounts.some(a=>a.id===p.wallet&&!a.closed&&!a.offbudget),'Wallet unavailable');
 assert(typeof p.holdingName==='string'&&p.holdingName.trim().length>=12&&/retenid|held/i.test(p.holdingName),'Holding name required');
 assert(!s.accounts.some(a=>a.name?.trim().toLowerCase()===p.holdingName.trim().toLowerCase()),'Holding account already exists');
 assert(typeof p.incomeCategoryName==='string'&&/venta/i.test(p.incomeCategoryName)&&/cancelad/i.test(p.incomeCategoryName),'Canceled-sale category name required');assert(s.categories.some(x=>x.group_id===p.incomeGroup&&x.is_income&&!x.hidden),'Income group unavailable');assert(!s.categories.some(x=>x.name?.trim().toLowerCase()===p.incomeCategoryName.trim().toLowerCase()),'Canceled-sale category already exists');const targetWidgets=widgetPlan(widgets);
 assert(s.payees.some(x=>x.id===p.payee&&!x.transfer_acct),'Marketplace payee required');
 assert(fileOK(p.reference)&&fileOK(p.reportId)&&fileOK(p.claimFileId),'Reference or report invalid');
 assert(Array.isArray(p.statementIds)&&p.statementIds.length>=3&&p.statementIds.every(fileOK),'Statements required');
 assert.equal(new Set([p.reportId,p.claimFileId,...p.statementIds]).size,p.statementIds.length+2,'Duplicate evidence');
 assert(textOK(p.evidence)&&textOK(p.reportingEvidence),'Evidence required');
 keys(p.sale,['date','amount','sourceId']);keys(p.hold,['date','releaseDate','amount','sourceId','releaseSourceId']);
 assert(dateOK(p.sale.date)&&dateOK(p.hold.date)&&dateOK(p.hold.releaseDate)&&p.sale.date<=p.hold.date&&p.hold.date<p.hold.releaseDate,'Invalid dates');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());assert(p.hold.releaseDate<=today,'Future settlement cannot be posted');
 assert(Number.isSafeInteger(p.sale.amount)&&p.sale.amount>0&&Number.isSafeInteger(p.hold.amount)&&p.hold.amount>0,'Invalid amounts');
 assert(Array.isArray(p.settlements)&&p.settlements.length>=2&&p.settlements.length<=12,'Settlement components required');
 for(const x of p.settlements){keys(x,['date','amount','sourceId']);assert(dateOK(x.date)&&x.date===p.hold.releaseDate&&Number.isSafeInteger(x.amount)&&x.amount!==0,'Invalid settlement');}
 assert(p.settlements.some(x=>x.amount>0)&&p.settlements.some(x=>x.amount<0),'Signed components required');
 const net=p.settlements.reduce((n,x)=>{const sum=n+x.amount;assert(Number.isSafeInteger(sum),'Unsafe aggregate amount');return sum},p.sale.amount);assert.equal(net,0,'Sale and settlement do not net to zero');
 const sources=newSources(p);assert(sources.every(sourceOK)&&new Set(sources).size===sources.length,'Invalid or duplicate source');
 assert(Array.isArray(p.fees)&&p.fees.length>=2,'Verified fees required');
 const feeIds=new Set();for(const f of p.fees){keys(f,['transaction','record']);const t=f.transaction,record=f.record;assert(t?.id&&!feeIds.has(t.id));feeIds.add(t.id);assert(t.account===p.wallet&&t.amount<0&&!t.is_parent&&!t.is_child&&!t.transfer_id&&!t.tombstone,'Invalid fee');
  const found=s.transactions.filter(x=>x.id===t.id);assert.equal(found.length,1);eq(found[0],t,'Fee snapshot changed');
  assert(t.imported_id&&record?.id===t.id&&record.type==='expense'&&record.currency===p.currency&&record.account===p.wallet&&record.date===t.date&&record.amount===t.amount&&(record.category??null)===(t.category??null)&&['registered','review'].includes(record.status)&&record.verifiedAt&&record.backup&&record.driveFileIds?.some(id=>[p.reportId,p.claimFileId,...p.statementIds].includes(id)),'Unverified fee');
  eq(l.cashflows?.[t.imported_id],record,'Fee ledger changed');
 }
 const audit=l.marketplaceHeldRefunds?.[p.reference];assert(!audit,'Existing or pending reconstruction requires investigation');
 assert(!Object.values(l.marketplaceHeldRefunds??{}).some(x=>x?.status==='pending'&&x.candidate?.wallet===p.wallet),'Pending reconstruction on wallet requires investigation');
 for(const group of Object.values(l)){if(!group||typeof group!=='object')continue;for(const [k,v] of Object.entries(group)){assert(!sources.includes(k),'Ledger source conflict');assert(!sources.some(x=>JSON.stringify(v).includes(x)),'Ledger source conflict');}}
 for(const t of s.transactions){assert(!sources.some(x=>t.imported_id===x||String(t.notes??'').includes(x)),'Transaction source conflict');if(t.account===p.wallet&&!t.tombstone&&dateOK(t.date)){const entries=[p.sale,...p.settlements,{date:p.hold.date,amount:-p.hold.amount},{date:p.hold.releaseDate,amount:p.hold.amount}];assert(!entries.some(x=>x.amount===t.amount&&Math.abs(day(x.date)-day(t.date))<=4),'Nearby duplicate requires review');}}
 assert(Array.isArray(p.checks)&&p.checks.length>=3,'Daily cuts required');let last='';
 const predicted=[p.sale,...p.settlements,{date:p.hold.date,amount:-p.hold.amount},{date:p.hold.releaseDate,amount:p.hold.amount}];
 for(const c of p.checks){keys(c,['date','balance']);assert(dateOK(c.date)&&c.date>last&&Number.isSafeInteger(c.balance),'Invalid cut');last=c.date;const old=s.transactions.filter(t=>t.account===p.wallet&&!t.is_child&&!t.tombstone&&t.date<=c.date).reduce((n,t)=>n+t.amount,0);const added=predicted.filter(t=>t.date<=c.date).reduce((n,t)=>n+t.amount,0);assert.equal(old+added,c.balance,'Statement balance mismatch');}
 assert(p.checks.some(c=>c.date===p.sale.date)&&p.checks.some(c=>c.date>=p.hold.date&&c.date<p.hold.releaseDate)&&p.checks.some(c=>c.date===p.hold.releaseDate),'Missing intermediate cut');
 return {action:'reconstruct',checks:p.checks,holdingFinal:0,walletFinalDelta:0,targetWidgets};
}

const heldNotes=(p,source)=>`Venta cancelada ${p.reference}; fondos retenidos o liquidación según reporte.\nhttps://drive.google.com/file/d/${p.reportId}/view\nhttps://drive.google.com/file/d/${p.claimFileId}/view\nsource=${source}`;
const hash=async(p,s,a)=>{const {createHash}=await import('node:crypto');return createHash('sha256').update(JSON.stringify(canon({p,s,a}))).digest('hex')};

function verifyHeldRefund(p,s,audit,closed){
 const account=s.accounts.find(x=>x.id===audit.holdingId);assert(account&&account.name===p.holdingName&&!!account.closed===closed&&!account.offbudget,'Holding account differs');
 assert.equal(s.balances[audit.holdingId],0,'Holding account is not zero');
 const toHeld=s.payees.filter(x=>x.transfer_acct===audit.holdingId),toWallet=s.payees.filter(x=>x.transfer_acct===p.wallet);assert.equal(toHeld.length,1);assert.equal(toWallet.length,1);
 const found=[];for(const e of [p.sale,...p.settlements]){
  const rows=s.transactions.filter(x=>x.imported_id===e.sourceId);assert.equal(rows.length,1,'Sale or settlement source missing');const t=rows[0];
  for(const [k,v] of Object.entries({account:p.wallet,date:e.date,amount:e.amount,payee:p.payee,category:audit.categoryId,notes:heldNotes(p,e.sourceId),transfer_id:null,cleared:false}))assert.equal(t[k]??null,v,'Settlement field differs: '+k);
  assert(!t.is_parent&&!t.is_child&&!t.parent_id&&!t.reconciled&&!t.schedule&&!t.tombstone&&!t.starting_balance_flag&&!t.subtransactions?.length,'Invalid settlement structure');found.push(t.id);
 }
 for(const e of [{date:p.hold.date,amount:-p.hold.amount,sourceId:p.hold.sourceId},{date:p.hold.releaseDate,amount:p.hold.amount,sourceId:p.hold.releaseSourceId}]){
  const rows=s.transactions.filter(x=>x.imported_id===e.sourceId);assert.equal(rows.length,1,'Hold source missing');const t=rows[0],leg=s.transactions.find(x=>x.id===t.transfer_id);assert(leg&&leg.transfer_id===t.id,'Transfer not reciprocal');
  for(const [k,v] of Object.entries({account:p.wallet,date:e.date,amount:e.amount,payee:toHeld[0].id,category:null,notes:heldNotes(p,e.sourceId),cleared:false}))assert.equal(t[k]??null,v,'Hold field differs: '+k);
  for(const [k,v] of Object.entries({account:audit.holdingId,date:e.date,amount:-e.amount,payee:toWallet[0].id,category:null,notes:heldNotes(p,e.sourceId),imported_id:null,cleared:false}))assert.equal(leg[k]??null,v,'Holding leg differs: '+k);
  for(const x of [t,leg])assert(!x.is_parent&&!x.is_child&&!x.parent_id&&!x.reconciled&&!x.schedule&&!x.tombstone&&!x.starting_balance_flag&&!x.subtransactions?.length,'Invalid transfer structure');found.push(t.id,leg.id);
 }
 for(const f of p.fees){const t=s.transactions.find(x=>x.id===f.transaction.id);eq(t,f.transaction,'Existing fee changed');}
 for(const c of p.checks){const balance=s.transactions.filter(t=>t.account===p.wallet&&!t.is_child&&!t.tombstone&&t.date<=c.date).reduce((n,t)=>n+t.amount,0);assert.equal(balance,c.balance,'Daily statement balance mismatch');}
 assert.equal(new Set(found).size,found.length,'Repeated transaction');return found.sort();
}
function verifyUnrelated(before,after,p,audit){
 for(const k of ['rules','schedules'])eq(after[k],before[k],`Unrelated ${k} changed`);const categories=new Map(after.categories.map(x=>[x.id,x]));for(const old of before.categories)eq(categories.get(old.id),old,'Existing category changed');assert.equal(after.categories.length,before.categories.length+1,'Unexpected categories');const category=categories.get(audit.categoryId);assert(category&&category.name===p.incomeCategoryName&&category.group_id===p.incomeGroup&&category.is_income&&!category.hidden,'Canceled-sale category differs');
 for(const k of ['accounts','payees','transactions']){const byId=new Map(after[k].map(x=>[x.id,x]));for(const old of before[k])eq(byId.get(old.id),old,`Existing ${k} changed`);}
 assert.equal(after.accounts.length,before.accounts.length+1,'Unexpected accounts');assert.equal(after.payees.length,before.payees.length+1,'Unexpected payees');assert.equal(after.transactions.length,before.transactions.length+1+p.settlements.length+4,'Unexpected transactions');
 for(const [id,value] of Object.entries(before.balances))assert.equal(after.balances[id],value,'Existing final balance changed');assert.equal(after.balances[audit.holdingId],0);
}
export async function reconstructHeldRefund(p,commit,d){
 assert(BUDGETS[p.currency],'Unsupported currency');
 let l=commit?await d.requireRun():await d.readState(),{api,rt}=await d.connect(BUDGETS[p.currency]?.syncId),before,beforeWidgets,action,dir,holdingId,categoryId;
 try{
  before=await d.snapshot(api);beforeWidgets=await d.readDashboard(api);const prior=l.marketplaceHeldRefunds?.[p.reference];
  if(prior){assert.equal(prior.status,'complete','Pending operation requires investigation');eq(prior.candidate,p,'Candidate conflicts with audit');const ids=verifyHeldRefund(p,before,prior,true);eq(ids,prior.ids,'Posted identities changed');eq(beforeWidgets,prior.widgetsAfter,'Dashboard changed since audit');return {action:'existing',verified:true,holdingId:prior.holdingId,backup:prior.backup};}
  action=classifyHeldRefund(p,before,l,beforeWidgets);const planHash=await hash(p,{budget:before,widgets:beforeWidgets},action);if(!commit)return {...action,candidate:p,planHash};
  assert.equal(d.expectedPlan,planHash,'Preview missing or changed');dir=await d.backup(api,p.currency,before);await d.json(dir+'/marketplace-held-refund.json',{candidate:p,action,beforeWidgets});await api.sync();eq(await d.snapshot(api),before,'Budget changed before write');eq(await d.readDashboard(api),beforeWidgets,'Dashboard changed before write');l=await d.requireRun();eq(classifyHeldRefund(p,before,l,beforeWidgets),action,'Preview changed');
  l.marketplaceHeldRefunds??={};l.marketplaceHeldRefunds[p.reference]={status:'pending',stage:'before-category',candidate:p,backup:dir};await d.save(l);await d.requireRun();
  categoryId=await api.createCategory({name:p.incomeCategoryName,group_id:p.incomeGroup,is_income:true});assert(typeof categoryId==='string'&&categoryId,'Category not created');l=await d.requireRun();l.marketplaceHeldRefunds[p.reference].categoryId=categoryId;l.marketplaceHeldRefunds[p.reference].stage='before-widgets';await d.save(l);const targetSet=new Set(action.targetWidgets);const widgetsAfter=beforeWidgets.map(w=>targetSet.has(w.id)?withExclusion(w,categoryId):w);for(const w of widgetsAfter.filter(w=>targetSet.has(w.id))){await d.requireRun();await d.updateWidget(rt,w)}eq(await d.readDashboard(api),widgetsAfter,'Dashboard filter verification failed');l=await d.requireRun();l.marketplaceHeldRefunds[p.reference].widgetsAfter=widgetsAfter;l.marketplaceHeldRefunds[p.reference].stage='before-account';await d.save(l);await d.requireRun();
  holdingId=await api.createAccount({name:p.holdingName,offbudget:false,closed:false},0);assert(typeof holdingId==='string'&&holdingId,'Holding account not created');l=await d.requireRun();l.marketplaceHeldRefunds[p.reference].holdingId=holdingId;l.marketplaceHeldRefunds[p.reference].stage='before-posting';await d.save(l);
  const payees=await api.getPayees(),toHeld=payees.filter(x=>x.transfer_acct===holdingId);assert.equal(toHeld.length,1);
  for(const e of [p.sale,...p.settlements]){await d.requireRun();await api.addTransactions(p.wallet,[{date:e.date,amount:e.amount,payee:p.payee,category:categoryId,imported_id:e.sourceId,notes:heldNotes(p,e.sourceId),cleared:false}],{runTransfers:false,learnCategories:false});}
  for(const e of [{date:p.hold.date,amount:-p.hold.amount,sourceId:p.hold.sourceId},{date:p.hold.releaseDate,amount:p.hold.amount,sourceId:p.hold.releaseSourceId}]){await d.requireRun();await api.addTransactions(p.wallet,[{date:e.date,amount:e.amount,payee:toHeld[0].id,category:null,imported_id:e.sourceId,notes:heldNotes(p,e.sourceId),cleared:false}],{runTransfers:true,learnCategories:false});}
  await api.sync();
 }finally{await api.shutdown()}
 ({api,rt}=await d.connect(BUDGETS[p.currency].syncId));let ids;try{
  const mid=await d.snapshot(api);ids=verifyHeldRefund(p,mid,{holdingId,categoryId},false);verifyUnrelated(before,mid,p,{holdingId,categoryId});eq(await d.readDashboard(api),l.marketplaceHeldRefunds[p.reference].widgetsAfter,'Dashboard changed');await d.json(dir+'/before-close.json',mid);
  l=await d.requireRun();assert.equal(l.marketplaceHeldRefunds?.[p.reference]?.stage,'before-posting');l.marketplaceHeldRefunds[p.reference].stage='verified-before-close';l.marketplaceHeldRefunds[p.reference].ids=ids;await d.save(l);await d.requireRun();await api.closeAccount(holdingId);await api.sync();
 }finally{await api.shutdown()}
 ({api,rt}=await d.connect(BUDGETS[p.currency].syncId));try{
  const after=await d.snapshot(api),finalIds=verifyHeldRefund(p,after,{holdingId,categoryId},true);eq(finalIds,ids,'Posted identities changed');verifyUnrelated(before,after,p,{holdingId,categoryId});eq(await d.readDashboard(api),l.marketplaceHeldRefunds[p.reference].widgetsAfter,'Dashboard changed');await d.json(dir+'/after.json',after);
  l=await d.requireRun();assert.equal(l.marketplaceHeldRefunds?.[p.reference]?.stage,'verified-before-close');eq(l.marketplaceHeldRefunds[p.reference].candidate,p,'Pending candidate changed');l.marketplaceHeldRefunds[p.reference]={...l.marketplaceHeldRefunds[p.reference],status:'complete',stage:'verified',ids,verifiedAt:new Date().toISOString()};await d.save(l);return {action:'reconstruct',verified:true,holdingId,categoryId,ids,backup:dir};
 }finally{await api.shutdown()}
}
