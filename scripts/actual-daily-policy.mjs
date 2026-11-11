import assert from 'node:assert/strict';
import { prefixNoteTags } from './actual-note-tags.mjs';
export const BUDGETS = {
 CLP:{syncId:'5c58e53d-be34-4968-b944-f5b3b8b3b874',name:'Finanzas CLP'},
 USD:{syncId:'da939d35-040a-4a5a-9309-f83aa809a1c6',name:'Finanzas USD'},
};
const dateOK=d=>typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
export const candidateImportedId=(c,id=c.sourceId)=>c.sourceType==='manual'?id:`gmail:${id}`;
export const candidateSourceNotes=c=>[...c.sourceIds.map(id=>c.sourceType==='manual'?`source=${id}`:`https://mail.google.com/mail/u/0/#all/${id}`),...(c.refundOf?[`refundOf=${c.refundOf}`]:[])].join('\n');
export const candidateTransactionNotes=c=>prefixNoteTags(c.notes)+'\n'+candidateSourceNotes(c);
export function validateCandidate(c){
 assert(BUDGETS[c.currency],'Only CLP/USD supported');
 assert(dateOK(c.date),'Invalid date');
 assert(Number.isSafeInteger(c.amount)&&(c.refundOf?c.amount>0:c.amount<0),'Expense must be negative; explicit refund must be positive integer cents');
 if(c.refundOf!==undefined){
  assert(typeof c.refundOf==='string'&&c.refundOf.trim(),'Refund needs original transaction ID');
  assert(typeof c.category==='string'&&c.category&&!c.splits&&!c.resolveId,'Refund needs an explicit category and cannot resolve or split a transaction');
 }
 if(c.refundSplitParent!==undefined)assert(c.refundOf&&!c.crossAccountRefund,'Split child refund requires a same-account refund');
 for(const k of ['account','sourceId','payeeName','evidence','notes']) assert(typeof c[k]==='string'&&c[k].trim(),`Missing ${k}`);
 assert(Array.isArray(c.sourceIds)&&c.sourceIds.length>0&&c.sourceIds.includes(c.sourceId)&&c.sourceIds.every(x=>typeof x==='string'&&x.trim()),'Missing source IDs');
 if(c.crossAccountRefund!==undefined){
  const x=c.crossAccountRefund;
  assert(c.refundOf&&x&&typeof x==='object'&&!Array.isArray(x),'Cross-account evidence requires a refund');
  assert(typeof x.originalAccount==='string'&&x.originalAccount&&x.originalAccount!==c.account,'Invalid original account');
  assert(typeof x.bankSourceId==='string'&&typeof x.merchantSourceId==='string'&&x.bankSourceId!==x.merchantSourceId&&c.sourceIds.includes(x.bankSourceId)&&c.sourceIds.includes(x.merchantSourceId),'Separate bank and merchant sources required');
  assert(c.sourceType===undefined||c.sourceType==='gmail','Cross-account evidence requires Gmail sources');
 }
 assert(c.sourceType===undefined||c.sourceType==='gmail'||c.sourceType==='manual','Unsupported source type');
 if(c.sourceType==='manual')assert(c.sourceIds.length===1&&/^manual:[a-z0-9:_-]+$/.test(c.sourceId),'Manual source needs one stable manual: ID');
 if(c.distinctPurchaseReason!==undefined) assert(typeof c.distinctPurchaseReason==='string'&&c.distinctPurchaseReason.trim(),'Invalid distinct purchase reason');
 assert(c.category==null||typeof c.category==='string','Invalid category');
 if(c.splits){
  assert(c.category==null,'Split parent must not have category');
  assert(c.splits.length>0&&c.splits.every(x=>Number.isSafeInteger(x.amount)&&x.amount<0&&typeof x.category==='string'&&x.category),'Invalid splits');
  assert.equal(c.splits.reduce((s,x)=>s+x.amount,0),c.amount,'Split amounts differ from total');
 }else if(!c.category) assert(typeof c.categoryReason==='string'&&c.categoryReason.trim(),'Explain pending category');
 return c;
}
export function validateRefund(c,transactions){
 if(!c.refundOf)return;
 let original;
 if(c.refundSplitParent){
  const x=c.refundSplitParent,expected=x.oldParent;
  assert(expected?.id&&expected.is_parent&&!expected.is_child&&!expected.transfer_id&&!expected.reconciled&&!expected.schedule&&expected.imported_id==null,'Refund requires an unreconciled historical split');
  assert(typeof x.statementFileId==='string'&&x.statementFileId.trim()&&c.notes.includes(`https://drive.google.com/file/d/${x.statementFileId}/view`),'Missing statement evidence');
  assert(typeof x.merchantSourceId==='string'&&x.merchantSourceId&&c.sourceIds.includes(x.merchantSourceId)&&c.sourceType!=='manual','Missing merchant evidence');
  const matches=transactions.filter(t=>t.id===expected.id);assert.equal(matches.length,1,'Split parent missing or ambiguous');
  assert.deepEqual(matches[0],expected,'Historical split changed');
  assert(Array.isArray(expected.subtransactions)&&expected.subtransactions.length>=2&&expected.amount<0&&expected.category==null,'Invalid historical split');
  assert.equal(expected.subtransactions.reduce((sum,t)=>sum+t.amount,0),expected.amount,'Split total mismatch');
  assert.equal(new Set(expected.subtransactions.map(t=>t.id)).size,expected.subtransactions.length,'Duplicate split child');
  for(const t of expected.subtransactions)assert(t.id&&t.is_child&&!t.is_parent&&t.parent_id===expected.id&&t.account===expected.account&&t.date===expected.date&&t.amount<0&&t.category&&!t.transfer_id,'Invalid split child');
  const children=expected.subtransactions.filter(t=>t.id===c.refundOf);assert.equal(children.length,1,'Refunded child missing or ambiguous');original=children[0];
  assert(!transactions.some(t=>t.notes?.split('\n').includes(`refundOf=${expected.id}`)),'Ambiguous prior refund of split parent');
 }else{
  original=transactions.find(t=>t.id===c.refundOf);
  assert(original&&original.amount<0&&!original.transfer_id&&!original.is_parent&&!original.is_child&&!original.subtransactions?.length,'Refund requires an existing simple expense');
 }
 if(c.crossAccountRefund)assert.equal(original.account,c.crossAccountRefund.originalAccount,'Original account differs from evidence');
 else assert.equal(original.account,c.account,'Refund account differs from original');
 assert.equal(original.category,c.category,'Refund category differs from original');
 assert(c.date>=original.date,'Refund predates original expense');
 const prior=transactions.filter(t=>t.imported_id!==candidateImportedId(c)&&t.notes?.split('\n').includes(`refundOf=${c.refundOf}`));
 assert(prior.every(t=>t.amount>0&&t.category===c.category),'Existing refund link is inconsistent');
 assert(prior.reduce((sum,t)=>sum+t.amount,0)+c.amount<=-original.amount,'Refunds exceed original expense');
}
export function installmentScheduleName(plan, installment){
 return `${plan.payeeName}; cuota ${installment.number}/${installment.total}; monto CLP${Math.abs(installment.amount)/100}; total CLP${Math.abs(plan.originalTotal)/100}; series=${plan.seriesKey}; source=Gmail ${plan.sourceIds.join('/')}; source=actual-daily`;
}
export function validateInstallmentPlan(p){
 assert(BUDGETS[p.currency],'Only CLP/USD supported');
 for(const k of ['account','payeeName','sourceId','evidence','notes','seriesKey'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(dateOK(p.purchaseDate),'Invalid purchase date');
 assert(Number.isInteger(p.billingDay)&&p.billingDay>=1&&p.billingDay<=31,'Invalid billing day');
 assert(Number.isSafeInteger(p.originalTotal)&&p.originalTotal<0,'Invalid original total');
 assert(Number.isSafeInteger(p.roundingAdjustment),'Invalid rounding adjustment');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&p.sourceIds.includes(p.sourceId),'Missing source IDs');
 assert(typeof p.category==='string'&&p.category.trim(),'Installments need a resolved category');
 assert(Array.isArray(p.installments)&&p.installments.length>0,'Missing installments');
 const total=p.installments.length;let sum=0;const numbers=new Set(),dates=new Set();
 for(const i of p.installments){
  assert(Number.isInteger(i.number)&&i.number>=1&&i.number<=total&&i.total===total,'Invalid installment numbering');
  assert(!numbers.has(i.number),'Duplicate installment number');numbers.add(i.number);
  assert(dateOK(i.date)&&i.date>p.purchaseDate,'Installment must be future-dated');
  assert(Number(i.date.slice(8,10))===p.billingDay,'Installment date is not on billing day');
  assert(!dates.has(i.date),'Duplicate installment date');dates.add(i.date);
  assert(Number.isSafeInteger(i.amount)&&i.amount<0,'Invalid installment amount');sum+=i.amount;
 }
 assert.equal(numbers.size,total,'Missing installment number');
 assert.equal(sum,p.originalTotal+p.roundingAdjustment,'Installments total does not match documented rounding');
 return p;
}
export function classifyInstallmentPlan(p,schedules){
 validateInstallmentPlan(p);
 const scheduleNames=p.installments.map(i=>installmentScheduleName(p,i));
 const matches=schedules.filter(s=>scheduleNames.includes(s.name));
 if(matches.length===0)return {action:'create',label:'Actual/Registered',scheduleNames};
 if(matches.length===scheduleNames.length&&new Set(matches.map(s=>s.name)).size===scheduleNames.length){
  return {action:'existing',label:'Actual/Registered',scheduleIds:scheduleNames.map(name=>matches.find(s=>s.name===name).id)};
 }
 return {action:'review',label:'Actual/Review',reason:'Partial or duplicated installment schedule already exists',scheduleIds:matches.map(s=>s.id)};
}
export function validateRemainingInstallmentPlan(p){
 assert(p.remainingInstallment===true,'Not a remaining installment plan');
 assert(BUDGETS[p.currency],'Only CLP/USD supported');
 for(const k of ['account','payeeName','sourceId','evidence','notes','seriesKey'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(dateOK(p.purchaseDate),'Invalid purchase date');
 assert(Number.isInteger(p.billingDay)&&p.billingDay>=1&&p.billingDay<=31,'Invalid billing day');
 assert(Number.isSafeInteger(p.originalTotal)&&p.originalTotal<0,'Invalid original total');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&p.sourceIds.includes(p.sourceId),'Missing source IDs');
 assert(typeof p.category==='string'&&p.category.trim(),'Remaining installments need a resolved category');
 assert(Array.isArray(p.billedInstallments)&&p.billedInstallments.length>0,'Missing billed installments');
 assert(p.installment&&typeof p.installment==='object','Missing remaining installment');
 const total=p.installment.total;
 assert(Number.isInteger(total)&&total>1,'Invalid installment total');
 assert(Number.isInteger(p.installment.number)&&p.installment.number>1&&p.installment.number<=total,'Invalid remaining installment number');
 assert(Number.isInteger(p.installment.number)===true,'Invalid remaining installment number');
 const numbers=new Set(),dates=new Set();let billedSum=0;
 for(const i of p.billedInstallments){
  assert(Number.isInteger(i.number)&&i.number>=1&&i.number<p.installment.number&&i.total===total,'Invalid billed installment numbering');
  assert(!numbers.has(i.number),'Duplicate billed installment number');numbers.add(i.number);
  assert(dateOK(i.statementDate),'Billed installment statement date is invalid');
  assert(!dates.has(i.statementDate),'Duplicate billed installment statement date');dates.add(i.statementDate);
  assert(Number.isSafeInteger(i.amount)&&i.amount<0,'Invalid billed installment amount');billedSum+=i.amount;
 }
 assert.equal(numbers.size,p.installment.number-1,'Missing billed installment number');
 assert(dateOK(p.installment.date)&&p.installment.date>p.purchaseDate,'Remaining installment must be future-dated');
 assert(Number(p.installment.date.slice(8,10))===p.billingDay,'Remaining installment date is not on billing day');
 assert(!dates.has(p.installment.date),'Remaining installment date duplicates a billed installment');
 assert(Number.isSafeInteger(p.installment.amount)&&p.installment.amount<0,'Invalid remaining installment amount');
 assert.equal(billedSum+p.installment.amount,p.originalTotal,'Billed and remaining installments do not match purchase total');
 return p;
}
export function classifyRemainingInstallmentPlan(p,schedules){
 validateRemainingInstallmentPlan(p);
 const name=installmentScheduleName(p,p.installment);
 const related=schedules.filter(s=>typeof s.name==='string'&&s.name.includes(`series=${p.seriesKey}`));
 const matches=related.filter(s=>s.name===name);
 if(related.length===0)return {action:'create',label:'Actual/Registered',scheduleNames:[name]};
 if(related.length===1&&matches.length===1)return {action:'existing',label:'Actual/Registered',scheduleIds:[matches[0].id]};
 return {action:'review',label:'Actual/Review',reason:'Conflicting or duplicated remaining installment schedule already exists',scheduleIds:related.map(s=>s.id)};
}
export function validateRemainingInstallmentsPlan(p){
 assert(p.remainingInstallments===true,'Not a remaining installments plan');
 assert(BUDGETS[p.currency],'Only CLP/USD supported');
 for(const k of ['account','payeeName','sourceId','evidence','notes','seriesKey'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(dateOK(p.purchaseDate),'Invalid purchase date');
 assert(Number.isInteger(p.billingDay)&&p.billingDay>=1&&p.billingDay<=31,'Invalid billing day');
 assert(Number.isSafeInteger(p.originalTotal)&&p.originalTotal<0,'Invalid original total');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&p.sourceIds.includes(p.sourceId),'Missing source IDs');
 assert(typeof p.category==='string'&&p.category.trim(),'Remaining installments need a resolved category');
 assert(Array.isArray(p.billedInstallments)&&p.billedInstallments.length>0,'Missing billed installments');
 assert(Array.isArray(p.futureInstallments)&&p.futureInstallments.length>0,'Missing future installments');
 const total=p.futureInstallments[0]?.total;assert(Number.isInteger(total)&&total>1,'Invalid installment total');
 const billedNumbers=new Set(),futureNumbers=new Set(),statementDates=new Set(),futureDates=new Set();let sum=0;
 for(const i of p.billedInstallments){
  assert(Number.isInteger(i.number)&&i.number>=1&&i.number<total&&i.total===total,'Invalid billed installment numbering');
  assert(!billedNumbers.has(i.number),'Duplicate billed installment number');billedNumbers.add(i.number);
  assert(dateOK(i.statementDate),'Billed installment statement date is invalid');
  assert(!statementDates.has(i.statementDate),'Duplicate billed installment statement date');statementDates.add(i.statementDate);
  assert(Number.isSafeInteger(i.amount)&&i.amount<0,'Invalid billed installment amount');sum+=i.amount;
 }
 for(const i of p.futureInstallments){
  assert(Number.isInteger(i.number)&&i.number>=1&&i.number<=total&&i.total===total,'Invalid future installment numbering');
  assert(!billedNumbers.has(i.number)&&!futureNumbers.has(i.number),'Duplicate installment number');futureNumbers.add(i.number);
  assert(dateOK(i.date)&&i.date>p.purchaseDate,'Future installment must be future-dated');
  assert(Number(i.date.slice(8,10))===p.billingDay,'Future installment date is not on billing day');
  assert(!statementDates.has(i.date)&&!futureDates.has(i.date),'Duplicate installment date');futureDates.add(i.date);
  assert(Number.isSafeInteger(i.amount)&&i.amount<0,'Invalid future installment amount');sum+=i.amount;
 }
 assert.equal(billedNumbers.size+futureNumbers.size,total,'Missing installment number');
 for(let n=1;n<=total;n++)assert(billedNumbers.has(n)||futureNumbers.has(n),`Missing installment number ${n}`);
 assert.equal(sum,p.originalTotal,'Billed and future installments do not match purchase total');
 return p;
}
export function classifyRemainingInstallmentsPlan(p,schedules){
 validateRemainingInstallmentsPlan(p);
 const names=p.futureInstallments.map(i=>installmentScheduleName(p,i));
 const related=schedules.filter(s=>typeof s.name==='string'&&s.name.includes(`series=${p.seriesKey}`));
 const matches=related.filter(s=>names.includes(s.name));
 if(related.length===0)return {action:'create',label:'Actual/Registered',scheduleNames:names};
 if(related.length===names.length&&new Set(matches.map(s=>s.name)).size===names.length)return {action:'existing',label:'Actual/Registered',scheduleIds:names.map(name=>matches.find(s=>s.name===name).id)};
 return {action:'review',label:'Actual/Review',reason:'Conflicting or duplicated remaining installment schedules already exist',scheduleIds:related.map(s=>s.id)};
}
export function validateScheduleAmendment(p){
 assert(BUDGETS[p.currency],'Only CLP/USD supported');
 for(const k of ['account','payeeName','category','seriesKey','sourceId','scheduleId','ruleId','date','scheduleName','newScheduleName','evidence','notes'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(dateOK(p.date),'Invalid amendment date');
 assert(Number.isInteger(p.targetNumber)&&p.targetNumber>=1,'Invalid target installment number');
 for(const k of ['oldAmount','newAmount','originalTotal'])assert(Number.isSafeInteger(p[k])&&p[k]<0,`Invalid ${k}`);
 assert.notEqual(p.oldAmount,p.newAmount,'Amendment must change the amount');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&p.sourceIds.includes(p.sourceId)&&p.sourceIds.every(x=>typeof x==='string'&&x.trim()),'Missing source IDs');
 assert(Array.isArray(p.series)&&p.series.length>0,'Missing schedule series');
 const total=p.series.length,numbers=new Set(),scheduleIds=new Set(),ruleIds=new Set(),dates=new Set();
 for(const item of p.series){
  assert(Number.isInteger(item.number)&&item.number>=1&&item.number<=total,'Invalid series number');
  assert(!numbers.has(item.number),'Duplicate series number');numbers.add(item.number);
  for(const k of ['scheduleId','ruleId','date'])assert(typeof item[k]==='string'&&item[k].trim(),`Missing series ${k}`);
  assert(dateOK(item.date),'Invalid series date');
  assert(!dates.has(item.date),'Duplicate series date');dates.add(item.date);
  assert(!scheduleIds.has(item.scheduleId),'Duplicate schedule ID');scheduleIds.add(item.scheduleId);
  assert(!ruleIds.has(item.ruleId),'Duplicate rule ID');ruleIds.add(item.ruleId);
  assert(Number.isSafeInteger(item.amount)&&item.amount<0,'Invalid series amount');
 }
 assert.equal(numbers.size,total,'Missing series number');
 const target=p.series.find(item=>item.number===p.targetNumber);
 assert(target,'Target installment is not in series');
 assert.equal(target.scheduleId,p.scheduleId,'Target schedule mismatch');
 assert.equal(target.ruleId,p.ruleId,'Target rule mismatch');
 assert.equal(target.date,p.date,'Target date mismatch');
 assert.equal(target.amount,p.oldAmount,'Target old amount mismatch');
 const sum=p.series.reduce((value,item)=>value+(item.number===p.targetNumber?p.newAmount:item.amount),0);
 assert.equal(sum,p.originalTotal,'Amended series total does not match purchase total');
 return p;
}
const condition=(rule,field)=>rule?.conditions?.find(item=>item.field===field);
const action=(rule,field)=>rule?.actions?.find(item=>item.op==='set'&&item.field===field);
const links=(rule,scheduleId)=>rule?.actions?.some(item=>item.op==='link-schedule'&&item.value===scheduleId);
function validScheduleAmendmentRule(rule,item,category){
 return condition(rule,'amount')?.value===item.amount&&links(rule,item.scheduleId)&&action(rule,'category')?.value===category;
}
export function classifyScheduleAmendment(p,schedules,rules){
 validateScheduleAmendment(p);
 const scheduleById=new Map(schedules.map(item=>[item.id,item])),ruleById=new Map(rules.map(item=>[item.id,item]));
 for(const item of p.series){
  const schedule=scheduleById.get(item.scheduleId),rule=ruleById.get(item.ruleId);
  if(!schedule||!rule)return {action:'review',label:'Actual/Review',reason:'Amendment series is missing a schedule or rule',scheduleId:p.scheduleId,ruleId:p.ruleId};
  if(schedule.account!==p.account||schedule.date!==item.date||schedule.amount!==item.amount||schedule.posts_transaction!==false||schedule.rule!==item.ruleId||schedule.payee!==scheduleById.get(p.scheduleId)?.payee){
   return {action:'review',label:'Actual/Review',reason:'Existing schedule series does not match the expected amounts or linkage',scheduleId:p.scheduleId,ruleId:p.ruleId};
  }
  if(!validScheduleAmendmentRule(rule,item,p.category))return {action:'review',label:'Actual/Review',reason:'Existing schedule rule does not match the expected category or amount',scheduleId:p.scheduleId,ruleId:p.ruleId};
 }
 const target=scheduleById.get(p.scheduleId);
 if(target.name!==p.scheduleName)return {action:'review',label:'Actual/Review',reason:'Target schedule name does not match the requested source series',scheduleId:p.scheduleId,ruleId:p.ruleId};
 return {action:'edit',label:'Actual/Registered',scheduleId:p.scheduleId,ruleId:p.ruleId,newAmount:p.newAmount,total:p.originalTotal};
}
export function validateScheduleNotesAmendment(p){
 assert(BUDGETS[p.currency],'Only CLP/USD supported');
 for(const k of ['account','payeeName','category','seriesKey','sourceId','notesBase','evidence'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&p.sourceIds.includes(p.sourceId)&&p.sourceIds.every(x=>typeof x==='string'&&x.trim()),'Missing source IDs');
 assert(Array.isArray(p.series)&&p.series.length>0,'Missing schedule series');
 const numbers=new Set(),scheduleIds=new Set(),ruleIds=new Set();
 for(const item of p.series){
  assert(Number.isInteger(item.number)&&item.number>=1&&item.number<=p.series.length,'Invalid series number');
  assert(!numbers.has(item.number),'Duplicate series number');numbers.add(item.number);
  for(const k of ['scheduleId','ruleId','date'])assert(typeof item[k]==='string'&&item[k].trim(),`Missing series ${k}`);
  assert(dateOK(item.date),'Invalid series date');
  assert(!scheduleIds.has(item.scheduleId),'Duplicate schedule ID');scheduleIds.add(item.scheduleId);
  assert(!ruleIds.has(item.ruleId),'Duplicate rule ID');ruleIds.add(item.ruleId);
  assert(Number.isSafeInteger(item.amount)&&item.amount<0,'Invalid series amount');
 }
 assert.equal(numbers.size,p.series.length,'Missing series number');
 return p;
}
export function classifyScheduleNotesAmendment(p,schedules,rules){
 validateScheduleNotesAmendment(p);
 const scheduleById=new Map(schedules.map(item=>[item.id,item])),ruleById=new Map(rules.map(item=>[item.id,item]));
 for(const item of p.series){
  const schedule=scheduleById.get(item.scheduleId),rule=ruleById.get(item.ruleId),payee=scheduleById.get(p.series[0].scheduleId)?.payee;
  if(!schedule||!rule)return {action:'review',label:'Actual/Review',reason:'Notes series is missing a schedule or rule'};
  if(schedule.account!==p.account||schedule.date!==item.date||schedule.amount!==item.amount||schedule.posts_transaction!==false||schedule.rule!==item.ruleId||schedule.payee!==payee)return {action:'review',label:'Actual/Review',reason:'Existing schedule series changed unexpectedly'};
  if(!validScheduleAmendmentRule(rule,item,p.category))return {action:'review',label:'Actual/Review',reason:'Existing schedule rule changed unexpectedly'};
 }
 return {action:'edit-notes',label:'Actual/Registered',scheduleIds:p.series.map(item=>item.scheduleId),ruleIds:p.series.map(item=>item.ruleId)};
}
export function applySimplePayeeCategoryRule(c,payees,rules){
 if(c.category||c.splits)return {candidate:c,ruleId:null};
 const payee=payees.find(p=>p.name.toLowerCase()===c.payeeName.toLowerCase()&&!p.transfer_acct);
 if(!payee)return {candidate:c,ruleId:null};
 const matches=rules.filter(r=>!r.tombstone&&r.conditionsOp==='and'&&r.conditions?.length===1&&r.actions?.length===1&&
  r.conditions[0].op==='is'&&r.conditions[0].field==='payee'&&r.conditions[0].value===payee.id&&r.conditions[0].type==='id'&&
  r.actions[0].op==='set'&&r.actions[0].field==='category'&&r.actions[0].type==='id'&&typeof r.actions[0].value==='string'&&r.actions[0].value);
 if(matches.length!==1)return {candidate:c,ruleId:null};
 const {categoryReason,...candidate}=c;
 return {candidate:{...candidate,category:matches[0].actions[0].value},ruleId:matches[0].id};
}
export function classifyCandidate(c,transactions){
 validateCandidate(c);
 const label=c.sourceType==='manual'?null:c.category||c.splits?'Actual/Registered':'Actual/Review';
 const sameSource=transactions.filter(t=>c.sourceIds.some(id=>t.imported_id===candidateImportedId(c,id)||(c.sourceType==='manual'?t.notes?.split('\n').includes(`source=${id}`):t.notes?.includes(`https://mail.google.com/mail/u/0/#all/${id}`))));
 assert(sameSource.length<=1,'Multiple transactions for source; manual review required');
 if(sameSource.length) return {action:'existing',label,id:sameSource[0].id};
 const similar=transactions.filter(t=>t.account===c.account&&t.amount===c.amount&&dateOK(t.date)&&Math.abs(Date.parse(t.date)-Date.parse(c.date))<=3*86400000);
 if(similar.length){
  if(c.distinctPurchaseReason) return {action:'create',label,similarIds:similar.map(t=>t.id)};
  return {action:'review',label:c.sourceType==='manual'?null:'Actual/Review',possibleIds:similar.map(t=>t.id)};
 }
 return {action:'create',label};
}
export function verifyTransaction(c,t){
 assert(t,'Transaction missing after download');
 for(const k of ['account','date','amount']) assert.equal(t[k],c[k],`Readback mismatch ${k}`);
 assert.equal(t.imported_id,candidateImportedId(c),'Readback source mismatch');
 if(c.refundOf)assert(t.notes?.split('\n').includes(`refundOf=${c.refundOf}`),'Readback refund link mismatch');
 if(c.splits){
  assert.equal(t.subtransactions?.length,c.splits.length,'Split count mismatch');
  const canonical=xs=>xs.map(x=>`${x.amount}:${x.category}`).sort();
  assert.deepEqual(canonical(t.subtransactions),canonical(c.splits));
 }else assert.equal(t.category??null,c.category??null,'Readback category mismatch');
}
export function validateResolution(c,t){
 validateCandidate(c);
 assert(typeof c.resolveId==='string'&&c.resolveId.trim(),'Resolution needs an existing transaction ID');
 assert(t&&t.id===c.resolveId,'Resolution transaction mismatch');
 assert(!t.category&&!t.is_parent&&!t.is_child&&!t.transfer_id&&!t.subtransactions?.length,'Only a simple uncategorized transaction can be resolved');
 const base={...c};delete base.resolveId;delete base.splits;base.category=null;
 verifyTransaction(base,t);
 if(c.splits)return {kind:'split',id:t.id};
 assert(c.category&&!c.splits,'Resolution needs one category or a verified split');
 return {kind:'category',id:t.id};
}
export function locateCreatedTransaction(c,transactions){
 const found=transactions.filter(t=>t.imported_id===candidateImportedId(c));
 assert.equal(found.length,1,'Expected exactly one transaction for source');
 return found[0].id;
}
const plus=(d,n)=>{assert(dateOK(d),'Invalid checkpoint date');return new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);};
export function nextWindows(today,s){
 const yesterday=plus(today,-1),dailyFrom=plus(s.dailyThrough,1),historicalFrom=plus(s.backfillThrough,1),historicalTo=[plus(s.dailyStart,-1),yesterday,plus(historicalFrom,6)].sort()[0];
 return {daily:dailyFrom<=yesterday?{from:dailyFrom,to:yesterday}:null,backfill:historicalFrom<=historicalTo?{from:historicalFrom,to:historicalTo}:null};
}

export function classifyCreditLineAccount(c,s,ledger){
 const allowed=new Set(['verifiedCreditLineAccount','currency','name','statementFileId','openingDate','evidence']);
 if(c.verifiedCreditLineAccount!==true)throw Error('Expected verified credit line');
 for(const k of Object.keys(c))if(!allowed.has(k))throw Error('Unexpected credit line field');
 if(!['CLP','USD'].includes(c.currency)||typeof c.name!=='string'||!c.name.trim()||typeof c.statementFileId!=='string'||!/^[A-Za-z0-9_-]{8,}$/.test(c.statementFileId)||typeof c.evidence!=='string'||!c.evidence.trim()||typeof c.openingDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.openingDate)||Number.isNaN(Date.parse(c.openingDate))||new Date(c.openingDate+'T12:00:00Z').toISOString().slice(0,10)!==c.openingDate)throw Error('Invalid credit line evidence');
 const matches=s.accounts.filter(a=>a.name.toLocaleLowerCase()===c.name.toLocaleLowerCase());
 const audit=ledger.creditLineAccounts?.[c.statementFileId];
 if(audit){if(JSON.stringify(audit.candidate)!==JSON.stringify(c)||matches.length!==1||matches[0].id!==audit.id||matches[0].closed||matches[0].offbudget||s.payees.filter(p=>p.transfer_acct===audit.id).length!==1)throw Error('Credit line audit conflict');return {action:'existing',id:audit.id};}
 if(matches.length)throw Error('Credit line account name already exists without audit');
 return {action:'create'};
}
export async function createVerifiedCreditLine(c,commit,d){
 assert(Object.hasOwn(BUDGETS,c.currency),'Unsupported budget');
 let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[c.currency]?.syncId),before,action,id,dir;
 try{
  before=await d.snapshot(api);action=classifyCreditLineAccount(c,before,ledger);if(!commit)return {...action,candidate:c};
  if(action.action==='existing')return {...action,verified:true,backup:ledger.creditLineAccounts[c.statementFileId].backup};
  dir=await d.backup(api,c.currency,before);await d.json(dir+'/credit-line-account.json',{candidate:c});await api.sync();assert.deepEqual(await d.snapshot(api),before,'Budget changed before account creation');classifyCreditLineAccount(c,before,await d.requireRun());
  id=await api.createAccount({name:c.name,offbudget:false,closed:false},0);assert(typeof id==='string'&&id,'Missing account ID');await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[c.currency].syncId));
 try{
  const after=await d.snapshot(api),created=after.accounts.filter(a=>a.id===id);assert.equal(created.length,1);assert.equal(created[0].name,c.name);assert(!created[0].closed&&!created[0].offbudget);assert.equal(after.balances[id],0);assert(!after.transactions.some(t=>t.account===id),'New account has transactions');
  assert.equal(after.accounts.length,before.accounts.length+1);assert.equal(after.payees.length,before.payees.length+1);const added=after.payees.filter(p=>!before.payees.some(q=>q.id===p.id));assert.equal(added.length,1);assert.equal(added[0].transfer_acct,id);assert.equal(added[0].name,c.name);
  for(const key of ['accounts','payees','transactions']){const byId=new Map(after[key].map(x=>[x.id,x]));assert.equal(byId.size,after[key].length);for(const x of before[key])assert.deepEqual(byId.get(x.id),x,'Existing '+key+' changed');}
  assert.equal(after.transactions.length,before.transactions.length);for(const key of ['categories','rules','schedules'])assert.deepEqual(after[key],before[key],'Unrelated '+key+' changed');for(const [a,b] of Object.entries(before.balances))assert.equal(after.balances[a],b,'Existing balance changed');assert.equal(Object.keys(after.balances).length,Object.keys(before.balances).length+1);
  await d.json(dir+'/after.json',after);ledger=await d.requireRun();ledger.creditLineAccounts??={};ledger.creditLineAccounts[c.statementFileId]={candidate:c,id,backup:dir,verifiedAt:new Date().toISOString()};await d.save(ledger);return {action:'create',id,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
