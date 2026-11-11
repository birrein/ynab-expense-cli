import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateTransactionNotes } from './actual-daily-policy.mjs';
import { candidateImportedId, candidateSourceNotes, validateRefund, validateCandidate, classifyCandidate, verifyTransaction, validateResolution, nextWindows, locateCreatedTransaction, applySimplePayeeCategoryRule, validateInstallmentPlan, classifyInstallmentPlan, installmentScheduleName, validateRemainingInstallmentPlan, classifyRemainingInstallmentPlan, validateRemainingInstallmentsPlan, classifyRemainingInstallmentsPlan, validateScheduleAmendment, classifyScheduleAmendment, validateScheduleNotesAmendment, classifyScheduleNotesAmendment } from './actual-daily-policy.mjs';
const c = { currency:'CLP', account:'account-1', date:'2026-10-10', amount:-815000, sourceId:'gmail-1', sourceIds:['gmail-1'], payeeName:'Merchant', category:null, notes:'Bank charge at 17:15', evidence:'Confirmed bank charge', categoryReason:'Comercio no identificado' };
test('future creation puts authorized hashtags first and preserves every source',()=>{
 const tagged={...c,notes:'Coffee #Trip\nUseful detail #café',sourceIds:['abc123','def456']};
 assert.equal(candidateTransactionNotes(tagged),'#Trip #café\nCoffee\nUseful detail\nhttps://mail.google.com/mail/u/0/#all/abc123\nhttps://mail.google.com/mail/u/0/#all/def456');
 assert.equal(tagged.notes,'Coffee #Trip\nUseful detail #café');
 assert.equal(candidateTransactionNotes({...c,sourceType:'manual',sourceIds:['manual:coffee'],notes:'Coffee #Trip'}),'#Trip\nCoffee\nsource=manual:coffee');
 assert.equal(candidateTransactionNotes({...tagged,refundOf:'purchase'}).split('\n').at(-1),'refundOf=purchase');
 assert.throws(()=>candidateTransactionNotes({...c,notes:'#Trip coffee #trip'}),/Duplicate tag/);
});
test('manual expenses preserve provenance and retry without inventing Gmail references',()=>{
 const manual={...c,sourceType:'manual',sourceId:'manual:cash-water',sourceIds:['manual:cash-water']};
 const t={id:'cash-1',account:manual.account,date:manual.date,amount:manual.amount,category:null,imported_id:candidateImportedId(manual),notes:candidateSourceNotes(manual)};
 assert.equal(t.imported_id,'manual:cash-water');assert.equal(t.notes,'source=manual:cash-water');
 assert.deepEqual(classifyCandidate(manual,[]),{action:'create',label:null});
 assert.deepEqual(classifyCandidate(manual,[t]),{action:'existing',id:'cash-1',label:null});
 assert.equal(locateCreatedTransaction(manual,[t]),'cash-1');assert.doesNotThrow(()=>verifyTransaction(manual,t));
 assert.throws(()=>verifyTransaction(manual,{...t,imported_id:'gmail:manual:cash-water'}));
 const second={...manual,sourceId:'manual:cash-fruit',sourceIds:['manual:cash-fruit']};
 assert.equal(classifyCandidate(second,[t]).action,'review');
 assert.equal(classifyCandidate({...second,distinctPurchaseReason:'User confirmed two separate cash purchases'},[t]).action,'create');
 assert.equal(classifyCandidate({...second,distinctPurchaseReason:'Different purchase'},[{...t,imported_id:'manual:cash-fruit'}]).action,'existing');
 for(const patch of [{sourceType:'unknown'},{sourceId:'gmail-1',sourceIds:['gmail-1']},{sourceIds:['manual:cash-water','manual:cash-fruit']}])assert.throws(()=>validateCandidate({...manual,...patch}));
});
test('confirmed uncategorized expense is registered but remains in Review',()=>{
 assert.equal(validateCandidate(c).amount,-815000);
 assert.deepEqual(classifyCandidate(c,[]),{action:'create',label:'Actual/Review'});
});
test('repeated source is not inserted again',()=>{
 assert.equal(classifyCandidate(c,[{id:'tx1',imported_id:'gmail:gmail-1'}]).action,'existing');
});
test('find created ID by source because Actual addTransactions returns ok, not IDs',()=>{
 assert.equal(locateCreatedTransaction(c,[{id:'real-id',imported_id:'gmail:gmail-1'}]),'real-id');
 assert.throws(()=>locateCreatedTransaction(c,[]));
 assert.throws(()=>locateCreatedTransaction(c,[{id:'one',imported_id:'gmail:gmail-1'},{id:'two',imported_id:'gmail:gmail-1'}]));
});
test('same date amount account without source is ambiguous, not automatically a duplicate',()=>{
 assert.equal(classifyCandidate(c,[{id:'tx1',account:'account-1',date:'2026-10-10',amount:-815000}]).action,'review');
});
test('nearby receipt and bank dates also require review before creating',()=>{
 assert.equal(classifyCandidate(c,[{id:'tx1',account:c.account,date:'2026-10-09',amount:c.amount}]).action,'review');
});
test('explicitly distinct same-day charges may bypass the similarity guard',()=>{
 const distinct={...c,distinctPurchaseReason:'Dos alertas bancarias con horas de compra distintas: 11:11 y 14:14.'};
 assert.deepEqual(classifyCandidate(distinct,[{id:'tx1',account:c.account,date:c.date,amount:c.amount}]),{action:'create',label:'Actual/Review',similarIds:['tx1']});
});
test('exact single-payee category rule categorizes an uncategorized candidate without overriding an explicit category',()=>{
 const payees=[{id:'payee-1',name:c.payeeName,transfer_acct:null}];
 const rules=[{id:'rule-1',stage:null,conditionsOp:'and',conditions:[{op:'is',field:'payee',value:'payee-1',type:'id'}],actions:[{op:'set',field:'category',value:'groceries',type:'id'}]}];
 const categorized={...c,category:'groceries'};delete categorized.categoryReason;
 const resolved=applySimplePayeeCategoryRule(c,payees,rules);
 assert.deepEqual(resolved,{candidate:categorized,ruleId:'rule-1'});
 assert.equal(validateCandidate(resolved.candidate).category,'groceries');
 assert.deepEqual(classifyCandidate(resolved.candidate,[]),{action:'create',label:'Actual/Registered'});
 assert.deepEqual(applySimplePayeeCategoryRule({...c,category:'chosen'},payees,rules),{candidate:{...c,category:'chosen'},ruleId:null});
});
test('ambiguous or broader rules do not automatically choose a category',()=>{
 const payees=[{id:'payee-1',name:c.payeeName,transfer_acct:null}];
 const rule={id:'rule-1',stage:null,conditionsOp:'and',conditions:[{op:'is',field:'payee',value:'payee-1',type:'id'}],actions:[{op:'set',field:'category',value:'groceries',type:'id'}]};
 assert.equal(applySimplePayeeCategoryRule(c,payees,[rule,{...rule,id:'rule-2',actions:[{op:'set',field:'category',value:'other',type:'id'}]}]).ruleId,null);
 assert.equal(applySimplePayeeCategoryRule(c,payees,[{...rule,conditions:[...rule.conditions,{op:'is',field:'account',value:'account-1',type:'id'}]}]).ruleId,null);
});
test('reject malformed dates, fractional cents, unsupported currency and missing evidence',()=>{
 for(const patch of [{date:'2026-02-30'},{amount:-1.5},{currency:'EUR'},{evidence:''},{sourceIds:[]},{categoryReason:''}]) assert.throws(()=>validateCandidate({...c,...patch}));
});
test('split totals and category requirements are enforced',()=>{
 assert.throws(()=>validateCandidate({...c,splits:[{amount:-1,category:'cat1'}]}));
 assert.throws(()=>validateCandidate({...c,splits:[{amount:-815000,category:null}]}));
 assert.doesNotThrow(()=>validateCandidate({...c,splits:[{amount:-815000,category:'cat1'}]}));
});
test('readback must match exact amounts category account and source',()=>{
 const t={id:'t1',account:c.account,date:c.date,amount:c.amount,category:null,imported_id:'gmail:gmail-1'};
 assert.doesNotThrow(()=>verifyTransaction(c,t));
 for(const patch of [{amount:-814999},{category:'wrong'},{account:'wrong'},{imported_id:'wrong'}]) assert.throws(()=>verifyTransaction(c,{...t,...patch}));
});
test('existing uncategorized expense can resolve to the verified Mundo split',()=>{
 const split={...c,date:'2026-08-13',amount:-1616800,resolveId:'tx1',category:null,splits:[
  {amount:-1599000,category:'tv-internet-mom',notes:'Internet mamita'},
  {amount:-17800,category:'interest-fees',notes:'Comisión Neat'},
 ]};
 const existing={id:'tx1',account:c.account,date:split.date,amount:split.amount,category:null,imported_id:'gmail:gmail-1',is_parent:false};
 assert.deepEqual(validateResolution(split,existing),{kind:'split',id:'tx1'});
 assert.throws(()=>validateResolution({...split,resolveId:'other'},existing));
});
test('daily and backfill windows are independent and capped at seven days',()=>{
 assert.deepEqual(nextWindows('2026-10-11',{dailyThrough:'2026-10-09',backfillThrough:'2026-08-07',dailyStart:'2026-10-10'}),{daily:{from:'2026-10-10',to:'2026-10-10'},backfill:{from:'2026-08-08',to:'2026-08-14'}});
 assert.equal(nextWindows('2026-10-11',{dailyThrough:'2026-10-10',backfillThrough:'2026-10-09',dailyStart:'2026-10-10'}).backfill,null);
});
test('installment plan validates future billing-day charges and explicit rounding',()=>{
 const plan={
  currency:'CLP',account:'account-1',payeeName:'Decathlon',category:'cycling',purchaseDate:'2026-10-12',billingDay:23,
  originalTotal:-4790000,roundingAdjustment:-100,seriesKey:'gmail:order-1',sourceId:'gmail-1',sourceIds:['gmail-1','gmail-2'],
  notes:'Chaqueta ciclismo impermeable; 3 cuotas; fuente Gmail',evidence:'Mercado Pago confirma 3 cuotas de $15.967',
  installments:[
   {number:1,total:3,date:'2026-10-23',amount:-1596700},
   {number:2,total:3,date:'2026-11-23',amount:-1596700},
   {number:3,total:3,date:'2026-12-23',amount:-1596700},
  ],
 };
 assert.equal(validateInstallmentPlan(plan).installments.length,3);
 assert.throws(()=>validateInstallmentPlan({...plan,roundingAdjustment:0}));
 assert.throws(()=>validateInstallmentPlan({...plan,installments:[{...plan.installments[0],date:'2026-10-24'},...plan.installments.slice(1)]}));
});
test('installment classification refuses partial existing schedule series',()=>{
 const plan={currency:'CLP',account:'account-1',payeeName:'Decathlon',category:'cycling',purchaseDate:'2026-10-12',billingDay:23,originalTotal:-4790000,roundingAdjustment:-100,seriesKey:'gmail:order-1',sourceId:'gmail-1',sourceIds:['gmail-1'],notes:'n',evidence:'e',installments:[
  {number:1,total:3,date:'2026-10-23',amount:-1596700},{number:2,total:3,date:'2026-11-23',amount:-1596700},{number:3,total:3,date:'2026-12-23',amount:-1596700},
 ]};
 const names=plan.installments.map(i=>installmentScheduleName(plan,i));
 assert.deepEqual(classifyInstallmentPlan(plan,[]),{action:'create',label:'Actual/Registered',scheduleNames:names});
 assert.equal(classifyInstallmentPlan(plan,[{id:'schedule-1',name:names[0]}]).action,'review');
 assert.deepEqual(classifyInstallmentPlan(plan,names.map((name,i)=>({id:`schedule-${i+1}`,name}))),{action:'existing',label:'Actual/Registered',scheduleIds:['schedule-1','schedule-2','schedule-3']});
});
test('remaining installment validates only the unbilled future charge and exact purchase total',()=>{
 const plan={
  remainingInstallment:true,currency:'CLP',account:'account-1',payeeName:'Decathlon',category:'cycling',purchaseDate:'2026-08-12',billingDay:23,
  originalTotal:-5530000,seriesKey:'gmail:decathlon-2026-08-12',sourceId:'gmail-1',sourceIds:['gmail-1','gmail-2'],
  notes:'Compra Decathlon; gift card CLP10000; gasto tarjeta CLP55300',evidence:'Estado de cuenta confirma 01/03 CLP18433 y 02/03 CLP18433; usuario confirma crear 03/03 futura.',
  billedInstallments:[
   {number:1,total:3,statementDate:'2026-08-21',amount:-1843300},
   {number:2,total:3,statementDate:'2026-09-22',amount:-1843300},
  ],
  installment:{number:3,total:3,date:'2026-10-23',amount:-1843400},
 };
 assert.equal(validateRemainingInstallmentPlan(plan).installment.amount,-1843400);
 assert.deepEqual(classifyRemainingInstallmentPlan(plan,[]),{action:'create',label:'Actual/Registered',scheduleNames:[installmentScheduleName(plan,plan.installment)]});
 assert.equal(classifyRemainingInstallmentPlan(plan,[{id:'schedule-3',name:installmentScheduleName(plan,plan.installment)}]).action,'existing');
 assert.equal(classifyRemainingInstallmentPlan(plan,[{id:'conflict',name:'Decathlon; cuota 3/3; monto CLP18433; total CLP55300; series=gmail:decathlon-2026-08-12'}]).action,'review');
 assert.throws(()=>validateRemainingInstallmentPlan({...plan,installment:{...plan.installment,amount:-1843300}}));
 assert.throws(()=>validateRemainingInstallmentPlan({...plan,billedInstallments:[...plan.billedInstallments,{number:3,total:3,date:'2026-10-23',amount:-1843400}]}));
});
test('remaining installments validate and classify all unbilled future charges as one series',()=>{
 const plan={
  remainingInstallments:true,currency:'CLP',account:'account-1',payeeName:'Top Mountain',category:'cycling',purchaseDate:'2026-08-21',billingDay:23,
  originalTotal:-4098000,seriesKey:'gmail:top-mountain-2026-08-21',sourceId:'gmail-1',sourceIds:['gmail-1','gmail-2','gmail-3'],
  notes:'Líquido sellante tubeless; gasto tarjeta CLP40980; categoría Cycling',evidence:'Estado de cuenta confirma 01/03 CLP13660; Mercado Pago confirma 3 cuotas sin interés.',
  billedInstallments:[{number:1,total:3,statementDate:'2026-09-22',amount:-1366000}],
  futureInstallments:[
   {number:2,total:3,date:'2026-10-23',amount:-1366000},
   {number:3,total:3,date:'2026-11-23',amount:-1366000},
  ],
 };
 assert.equal(validateRemainingInstallmentsPlan(plan).futureInstallments.length,2);
 const names=plan.futureInstallments.map(i=>installmentScheduleName(plan,i));
 assert.deepEqual(classifyRemainingInstallmentsPlan(plan,[]),{action:'create',label:'Actual/Registered',scheduleNames:names});
 assert.deepEqual(classifyRemainingInstallmentsPlan(plan,names.map((name,i)=>({id:`schedule-${i+2}`,name}))),{action:'existing',label:'Actual/Registered',scheduleIds:['schedule-2','schedule-3']});
 assert.equal(classifyRemainingInstallmentsPlan(plan,[{id:'partial',name:names[0]}]).action,'review');
 assert.throws(()=>validateRemainingInstallmentsPlan({...plan,futureInstallments:[{...plan.futureInstallments[0],date:'2026-10-24'},plan.futureInstallments[1]]}));
});
test('schedule amendment requires the existing series and exact final total',()=>{
 const amendment={
  currency:'CLP',account:'account-1',payeeName:'Decathlon',category:'cycling',seriesKey:'gmail:order-1',sourceId:'gmail-1',sourceIds:['gmail-1','gmail-2'],
  scheduleId:'schedule-3',ruleId:'rule-3',date:'2026-12-23',targetNumber:3,oldAmount:-1596700,newAmount:-1596600,originalTotal:-4790000,
  scheduleName:'Decathlon; cuota 3/3; monto CLP15967; total CLP47900; series=gmail:order-1',
  newScheduleName:'Decathlon; cuota 3/3; monto CLP15966; total CLP47900; series=gmail:order-1',
  evidence:'Usuario confirma ajuste de la última cuota para sumar el precio real.',notes:'Corrección explícita de cuota 3/3.',
  series:[
   {number:1,scheduleId:'schedule-1',ruleId:'rule-1',date:'2026-10-23',amount:-1596700},
   {number:2,scheduleId:'schedule-2',ruleId:'rule-2',date:'2026-11-23',amount:-1596700},
   {number:3,scheduleId:'schedule-3',ruleId:'rule-3',date:'2026-12-23',amount:-1596700},
  ],
 };
 assert.equal(validateScheduleAmendment(amendment).newAmount,-1596600);
 assert.deepEqual(classifyScheduleAmendment(amendment,[
  {id:'schedule-1',name:'s1',account:'account-1',payee:'payee-1',date:'2026-10-23',amount:-1596700,posts_transaction:false,rule:'rule-1'},
  {id:'schedule-2',name:'s2',account:'account-1',payee:'payee-1',date:'2026-11-23',amount:-1596700,posts_transaction:false,rule:'rule-2'},
  {id:'schedule-3',name:amendment.scheduleName,account:'account-1',payee:'payee-1',date:'2026-12-23',amount:-1596700,posts_transaction:false,rule:'rule-3'},
 ],[
  {id:'rule-1',conditions:[{field:'amount',value:-1596700}],actions:[{op:'link-schedule',value:'schedule-1'},{op:'set',field:'category',value:'cycling'}]},
  {id:'rule-2',conditions:[{field:'amount',value:-1596700}],actions:[{op:'link-schedule',value:'schedule-2'},{op:'set',field:'category',value:'cycling'}]},
  {id:'rule-3',conditions:[{field:'amount',value:-1596700}],actions:[{op:'link-schedule',value:'schedule-3'},{op:'set',field:'category',value:'cycling'}]},
 ]),{action:'edit',label:'Actual/Registered',scheduleId:'schedule-3',ruleId:'rule-3',newAmount:-1596600,total:-4790000});
 assert.throws(()=>validateScheduleAmendment({...amendment,newAmount:-1596500}));
 assert.equal(classifyScheduleAmendment(amendment,[
  {id:'schedule-1',name:'s1',account:'account-1',payee:'payee-1',date:'2026-10-23',amount:-1596700,posts_transaction:false,rule:'rule-1'},
  {id:'schedule-2',name:'s2',account:'account-1',payee:'payee-1',date:'2026-11-23',amount:-1596700,posts_transaction:false,rule:'rule-2'},
  {id:'schedule-3',name:amendment.scheduleName,account:'account-1',payee:'payee-1',date:'2026-12-23',amount:-1596800,posts_transaction:false,rule:'rule-3'},
 ],[]).action,'review');
});
test('schedule notes amendment preserves the exact existing series',()=>{
 const amendment={currency:'CLP',account:'account-1',payeeName:'Decathlon',category:'cycling',seriesKey:'gmail:order-1',sourceId:'gmail-1',sourceIds:['gmail-1'],notesBase:'Serie suma exactamente CLP47.900',evidence:'Usuario confirmó la suma real.' ,series:[
  {number:1,scheduleId:'schedule-1',ruleId:'rule-1',date:'2026-10-23',amount:-1596700},
  {number:2,scheduleId:'schedule-2',ruleId:'rule-2',date:'2026-11-23',amount:-1596700},
  {number:3,scheduleId:'schedule-3',ruleId:'rule-3',date:'2026-12-23',amount:-1596600},
 ]};
 assert.equal(validateScheduleNotesAmendment(amendment).series.length,3);
 assert.equal(classifyScheduleNotesAmendment(amendment,[
  {id:'schedule-1',account:'account-1',payee:'payee-1',date:'2026-10-23',amount:-1596700,posts_transaction:false,rule:'rule-1'},
  {id:'schedule-2',account:'account-1',payee:'payee-1',date:'2026-11-23',amount:-1596700,posts_transaction:false,rule:'rule-2'},
  {id:'schedule-3',account:'account-1',payee:'payee-1',date:'2026-12-23',amount:-1596600,posts_transaction:false,rule:'rule-3'},
 ],[
  {id:'rule-1',conditions:[{field:'amount',value:-1596700}],actions:[{op:'link-schedule',value:'schedule-1'},{op:'set',field:'category',value:'cycling'}]},
  {id:'rule-2',conditions:[{field:'amount',value:-1596700}],actions:[{op:'link-schedule',value:'schedule-2'},{op:'set',field:'category',value:'cycling'}]},
  {id:'rule-3',conditions:[{field:'amount',value:-1596600}],actions:[{op:'link-schedule',value:'schedule-3'},{op:'set',field:'category',value:'cycling'}]},
 ]).action,'edit-notes');
});

test('refunds preserve the original and enforce account, category, date and cumulative limit',()=>{
 const original={id:'purchase',account:c.account,date:c.date,amount:-1000,category:'groceries'};
 const refund={...c,amount:400,refundOf:'purchase',category:'groceries',sourceId:'refund-1',sourceIds:['refund-1']};
 assert.doesNotThrow(()=>validateCandidate(refund));assert.doesNotThrow(()=>validateRefund(refund,[original]));
 const posted={...refund,id:'posted-refund',imported_id:candidateImportedId(refund),notes:candidateSourceNotes(refund)};
 assert.doesNotThrow(()=>verifyTransaction(refund,posted));
 assert.equal(classifyCandidate(refund,[original,posted]).action,'existing');
 assert.doesNotThrow(()=>validateRefund(refund,[original,posted]));
 for(const patch of [{amount:-400},{refundOf:undefined},{category:null},{splits:[{amount:400,category:'groceries'}]}])assert.throws(()=>validateCandidate({...refund,...patch}));
 for(const patch of [{account:'wrong'},{category:'wrong'},{date:'2026-10-09'},{amount:1001},{refundOf:'missing'}])assert.throws(()=>validateRefund({...refund,...patch},[original]));
 assert.throws(()=>validateRefund({...refund,amount:700,sourceId:'refund-2'},[original,posted]));
 assert.throws(()=>verifyTransaction(refund,{...posted,notes:'missing link'}));
});

test('cross-account refunds require separate merchant and settlement sources and count all prior refunds',()=>{
 const original={id:'purchase',amount:-1000,account:'card',category:'groceries',date:'2026-10-01'};
 const base={currency:'CLP',date:'2026-10-02',amount:400,account:'current',sourceId:'bank',sourceIds:['bank','merchant'],payeeName:'shop',evidence:'confirmed settlement',notes:'refund',category:'groceries',refundOf:'purchase',crossAccountRefund:{originalAccount:'card',bankSourceId:'bank',merchantSourceId:'merchant'}};
 assert.doesNotThrow(()=>validateCandidate(base));
 assert.doesNotThrow(()=>validateRefund(base,[original]));
 assert.throws(()=>validateRefund({...base,crossAccountRefund:undefined},[original]));
 for(const patch of [{originalAccount:'wrong',bankSourceId:'bank',merchantSourceId:'merchant'},{originalAccount:'card',bankSourceId:'bank',merchantSourceId:'bank'},{originalAccount:'card',bankSourceId:'absent',merchantSourceId:'merchant'}])assert.throws(()=>{const x={...base,crossAccountRefund:patch};validateCandidate(x);validateRefund(x,[original]);});
 const prior={amount:700,account:'card',category:'groceries',notes:'refundOf=purchase',imported_id:'gmail:old'};
 assert.throws(()=>validateRefund(base,[original,prior]));
 assert.throws(()=>validateCandidate({...base,refundOf:undefined}));
});

test('evidenced historical split refund preserves child category and enforces its individual bounds',()=>{
 const child={id:'child',parent_id:'parent',is_child:true,is_parent:false,account:'card',date:'2026-10-01',amount:-600,category:'electronics',transfer_id:null};
 const sibling={...child,id:'sibling',amount:-400,category:'household'};
 const parent={id:'parent',is_parent:true,is_child:false,account:'card',date:'2026-10-01',amount:-1000,category:null,transfer_id:null,reconciled:false,schedule:null,subtransactions:[child,sibling]};
 const refund={currency:'CLP',date:'2026-10-02',amount:600,account:'card',sourceId:'merchant',sourceIds:['merchant'],payeeName:'shop',category:'electronics',refundOf:'child',notes:'Refund https://drive.google.com/file/d/statement/view',evidence:'Merchant cancellation and settled bank refund',refundSplitParent:{oldParent:parent,statementFileId:'statement',merchantSourceId:'merchant'}};
 assert.doesNotThrow(()=>validateCandidate(refund));assert.doesNotThrow(()=>validateRefund(refund,[parent]));
 const posted={...refund,id:'refund',imported_id:candidateImportedId(refund),notes:candidateSourceNotes(refund)};
 assert.doesNotThrow(()=>validateRefund(refund,[parent,posted]));
 for(const patch of [{amount:601},{account:'wrong'},{category:'household'},{date:'2026-09-30'},{refundOf:'missing'}])assert.throws(()=>validateRefund({...refund,...patch},[parent]));
 assert.throws(()=>validateRefund(refund,[{...parent,amount:-999}]));
 assert.throws(()=>validateRefund({...refund,refundSplitParent:{...refund.refundSplitParent,statementFileId:''}},[parent]));
 assert.throws(()=>validateRefund({...refund,refundSplitParent:{...refund.refundSplitParent,merchantSourceId:'missing'}},[parent]));
 assert.throws(()=>validateRefund({...refund,sourceId:'different',sourceIds:['different','merchant']},[parent,posted]));
 assert.throws(()=>validateRefund(refund,[parent,{id:'prior-parent-refund',amount:100,notes:'refundOf=parent'}]));
 assert.throws(()=>validateRefund({...refund,crossAccountRefund:{originalAccount:'other'}},[parent]));
 const changedParent=p=>({...refund,refundSplitParent:{...refund.refundSplitParent,oldParent:p}});
 for(const p of [{...parent,reconciled:true},{...parent,schedule:'schedule'},{...parent,subtransactions:[child,child]},{...parent,amount:-999},{...parent,imported_id:'gmail:already-owned'}])assert.throws(()=>validateRefund(changedParent(p),[p]));
 const partial={id:'earlier',amount:1,category:'electronics',notes:'refundOf=child',imported_id:'gmail:earlier'};
 assert.throws(()=>validateRefund(refund,[parent,partial]));
 assert.throws(()=>validateCandidate({...refund,refundOf:undefined}));
 assert.equal(classifyCandidate(refund,[parent,posted]).action,'existing');
});
