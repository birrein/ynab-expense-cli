import test from 'node:test';import assert from 'node:assert/strict';import {classifyCashflow,cashflow} from './actual-cashflow.mjs';
const base={cashflow:true,type:'transfer',currency:'CLP',account:'a',destination:'b',date:'2026-09-01',amount:-50000,sourceId:'bank:ABC123',sourceIds:['abc'],evidence:'Bank origin',counterpartyEvidence:'Bank destination',notes:'Own transfer'};
const snap=()=>({accounts:[{id:'a',closed:false,offbudget:false},{id:'b',closed:false,offbudget:false}],payees:[{id:'pb',transfer_acct:'b'},{id:'pa',transfer_acct:'a'}],categories:[{id:'income',is_income:true}],transactions:[]});
test('previews a verified native transfer',()=>assert.equal(classifyCashflow(base,snap()).action,'create'));
test('rejects ambiguous existing amount in destination',()=>{const s=snap();s.transactions.push({account:'b',date:base.date,amount:50000});assert.equal(classifyCashflow(base,s).action,'review')});
test('rejects same or unknown account',()=>assert.equal(classifyCashflow({...base,destination:'a'},snap()).action,'review'));
test('income must be positive and have a known income category',()=>{const s=snap();const c={...base,type:'income',amount:50000,category:'income',payeeName:'Employer'};delete c.destination;assert.equal(classifyCashflow(c,s).action,'create');assert.equal(classifyCashflow({...c,category:'fake'},s).action,'review')});
test('rejects mixed operation flags',()=>assert.equal(classifyCashflow({...base,postInstallment:true},snap()).action,'review'));
test('statement-backed bank fee requires a negative amount and non-income category',()=>{const s=snap();s.categories.push({id:'fee',is_income:false,hidden:false});const c={...base,type:'expense',amount:-300,category:'fee',payeeName:'Bank'};delete c.destination;assert.equal(classifyCashflow(c,s).action,'create');assert.equal(classifyCashflow({...c,amount:300},s).action,'review');assert.equal(classifyCashflow({...c,category:'income'},s).action,'review')});

test('accepts independently verified Drive statement without Gmail source',()=>{const c={...base,sourceIds:[],driveFileIds:['1GCD8yJxHluOyJjaRso-yhOVmlXpQQlQ2']};assert.equal(classifyCashflow(c,snap()).action,'create')});
test('accepts combined Gmail and Drive evidence',()=>{const c={...base,driveFileIds:['1GCD8yJxHluOyJjaRso-yhOVmlXpQQlQ2']};assert.equal(classifyCashflow(c,snap()).action,'create')});
test('rejects missing, malformed and repeated Drive evidence',()=>{for(const driveFileIds of [[],['https://drive.google.com/file/d/not-an-id/view'],['valid_id','valid_id'],[''],[42]])assert.equal(classifyCashflow({...base,sourceIds:[],driveFileIds},snap()).action,'review')});
test('existing Drive-backed transfer is idempotent and preserves source links',()=>{const c={...base,sourceIds:[],driveFileIds:['abc_DEF-123']};const s=snap();s.transactions.push({id:'a1',account:'a',date:c.date,amount:c.amount,notes:'Own transfer\nhttps://drive.google.com/file/d/abc_DEF-123/view\nsource=bank:ABC123',imported_id:c.sourceId,category:null,transfer_id:'b1'},{id:'b1',account:'b',date:c.date,amount:-c.amount,category:null,transfer_id:'a1'});assert.equal(classifyCashflow(c,s).action,'existing')});
test('existing Gmail-only transfer remains idempotent',()=>{const s=snap();s.transactions.push({id:'a1',account:'a',date:base.date,amount:base.amount,notes:'Own transfer\nhttps://mail.google.com/mail/u/0/#all/abc\nsource=bank:ABC123',imported_id:base.sourceId,category:null,transfer_id:'b1'},{id:'b1',account:'b',date:base.date,amount:-base.amount,category:null,transfer_id:'a1'});assert.equal(classifyCashflow(base,s).action,'existing')});
test('rejects explicit non-array Drive evidence even if Gmail evidence exists',()=>assert.equal(classifyCashflow({...base,driveFileIds:null},snap()).action,'review'));
const distinct=()=>({...base,driveFileIds:['statement1'],distinctTransfer:{existingOriginId:'old-origin',existingDestinationId:'old-dest',existingSourceIds:['def'],statementFileId:'statement1',evidence:'Two origin receipts and two destination credits independently verified.'}});
const withDistinct=()=>{const s=snap();s.accounts.push({id:'c'});s.payees.push({id:'pc',transfer_acct:'c'});s.transactions.push({id:'old-origin',account:'c',date:base.date,amount:base.amount,transfer_id:'old-dest',category:null},{id:'old-dest',account:'b',date:base.date,amount:-base.amount,transfer_id:'old-origin',category:null});return s};
test('accepts specifically evidenced distinct transfers from different origins',()=>assert.equal(classifyCashflow(distinct(),withDistinct()).action,'create'));
test('rejects incomplete or overlapping distinct-transfer evidence and extra matches',()=>{
 for(const patch of [{existingSourceIds:['abc']},{existingOriginId:'bad'},{existingDestinationId:'bad'},{statementFileId:'other'},{evidence:''},{evidence:42},{existingOriginId:42}]){const c=distinct();Object.assign(c.distinctTransfer,patch);assert.equal(classifyCashflow(c,withDistinct()).action,'review')}
 let s=withDistinct();s.transactions.push({id:'extra',account:'b',date:base.date,amount:-base.amount});assert.equal(classifyCashflow(distinct(),s).action,'review');
 s=withDistinct();s.transactions[0].account='a';assert.equal(classifyCashflow(distinct(),s).action,'review');
 s=withDistinct();s.transactions[1].transfer_id='other';assert.equal(classifyCashflow(distinct(),s).action,'review');
});
const dated=()=>({...base,date:'2026-07-03',sourceIds:[],driveFileIds:['statement1','statement2'],distinctStatementTransfer:{existingOriginId:'old-origin',existingDestinationId:'old-dest',existingSourceId:'def',existingStatementDate:'2026-07-08',statementFileId:'statement1',evidence:'Statements show two separate credits.'}});
const datedSnap=()=>{const s=withDistinct();s.transactions[0].date='2026-07-07';s.transactions[1].date='2026-07-07';s.transactions[0].notes='source=def';s.transactions[1].notes='source=def';s.transactions[0].payee='pb';s.transactions[1].payee='pc';return s};
test('accepts a differently dated statement-backed distinct transfer',()=>assert.equal(classifyCashflow(dated(),datedSnap()).action,'create'));
test('rejects conflicting statement-backed exception and extra matches',()=>{for(const patch of [{existingSourceId:'abc'},{existingStatementDate:'2026-07-03'},{existingStatementDate:'2026-02-30'},{statementFileId:'other'},{existingOriginId:'bad'}]){let c=dated();Object.assign(c.distinctStatementTransfer,patch);assert.equal(classifyCashflow(c,datedSnap()).action,'review')}let s=datedSnap();s.transactions.push({id:'extra',account:'b',date:'2026-07-03',amount:50000});assert.equal(classifyCashflow(dated(),s).action,'review')});
test('verified statement expense can remain uncategorized with explicit review reason',()=>{const s=snap(),c={...base,type:'expense',amount:-7500,payeeName:'Store',category:null,categoryReason:'Items unknown',sourceIds:[],driveFileIds:['statement1']};delete c.destination;assert.equal(classifyCashflow(c,s).action,'create');assert.equal(classifyCashflow({...c,categoryReason:''},s).action,'review');assert.equal(classifyCashflow({...c,category:'fake'},s).action,'review')});
test('uncategorized statement expense verifies its reason and source on retry',()=>{const s=snap(),c={...base,type:'expense',amount:-7500,payeeName:'Store',category:null,categoryReason:'Items unknown',sourceIds:[],driveFileIds:['statement1']};delete c.destination;s.payees.push({id:'store',name:'Store'});s.transactions.push({id:'tx',account:'a',date:c.date,amount:c.amount,payee:'store',category:null,imported_id:c.sourceId,notes:'Own transfer\nCategoría pendiente: Items unknown\nhttps://drive.google.com/file/d/statement1/view\nsource=bank:ABC123'});assert.equal(classifyCashflow(c,s).action,'existing');assert.equal(classifyCashflow({...c,categoryReason:'Different'},s).action,'review')});
const distinctExpense=()=>({cashflow:true,type:'expense',currency:'CLP',account:'a',date:'2025-12-15',amount:-999000,sourceId:'bank:second',sourceIds:['abc123'],driveFileIds:['statement1'],evidence:'Two separate purchases in statement',notes:'Xbox',category:'games',payeeName:'Microsoft',distinctStatementExpense:{existingId:'old',existingSourceId:'def456',statementFileId:'statement1',evidence:'Apple and Microsoft receipts and statement differ'}});
const distinctExpenseSnap=()=>{let s=snap();s.categories.push({id:'games',is_income:false});s.payees.push({id:'apple',name:'Apple'},{id:'ms',name:'Microsoft'});s.transactions.push({id:'old',account:'a',date:'2025-12-14',amount:-999000,payee:'apple',notes:'https://mail.google.com/mail/u/0/#all/def456\nhttps://drive.google.com/file/d/statement1/view'});return s};
const gmailDistinct=()=>{
 const s=snap();s.payees.push({id:'uber',name:'Uber One'});s.categories.push({id:'sub',is_income:false});
 const prior={id:'prior',account:'a',date:'2025-12-27',amount:-399000,payee:'uber',category:'sub',imported_id:'gmail:abcdef0123456789',notes:'Uber\nhttps://mail.google.com/mail/u/0/#all/abcdef0123456789\nhttps://mail.google.com/mail/u/0/#all/abcdef0123456790',is_parent:false,is_child:false,transfer_id:null};
 s.transactions.push(prior);
 const record={transactionId:'prior',currency:'CLP',account:'a',date:prior.date,amount:prior.amount,payee:'Uber One',category:'sub',sourceIds:['abcdef0123456789','abcdef0123456790'],status:'registered',verifiedAt:'2026-01-01T00:00:00Z',backup:'/private/backup'};
 const l={records:Object.fromEntries(record.sourceIds.map(id=>[id,structuredClone(record)]))};
 const c={cashflow:true,type:'expense',currency:'CLP',account:'a',date:'2025-12-25',amount:-399000,sourceId:'bank:gentille:row',sourceIds:['abcdef0123456791'],driveFileIds:['statement1'],evidence:'Statement and independent bank notices inspected.',notes:'Purchase',category:null,categoryReason:'Items unknown',payeeName:'Gentille',distinctGmailStatementExpense:{statementFileId:'statement1',priorTransaction:structuredClone(prior),priorRecord:structuredClone(record),priorSourceId:'abcdef0123456789',priorStatementReference:'291202701708',newStatementReference:'261211215024',priorStatementDescriptor:'Uber',newStatementDescriptor:'Gentille',evidence:'Statement contains distinct dates merchants and references.'}};
 return {s,c,l};
};
test('a separately evidenced bank row can coexist with an exact Gmail-backed prior expense',()=>{const {s,c,l}=gmailDistinct();const a=classifyCashflow(c,s,l);assert.equal(a.action,'create');assert.equal(a.label,'Actual/Review')});
test('Gmail-backed exception fails closed for stale, incomplete or overlapping evidence',()=>{
 for(const mutate of [
  ({c})=>c.distinctGmailStatementExpense.priorSourceId='abcdef0123456791',
  ({c})=>c.distinctGmailStatementExpense.newStatementReference=c.distinctGmailStatementExpense.priorStatementReference,
  ({c})=>c.distinctGmailStatementExpense.newStatementDescriptor='Uber',
  ({c})=>c.distinctGmailStatementExpense.statementFileId='other',
  ({s})=>s.transactions[0].notes='changed',
  ({l})=>delete l.records.abcdef0123456790,
  ({l})=>l.records.abcdef0123456789.verifiedAt=null,
  ({c})=>c.sourceIds=['abcdef0123456790'],
  ({s})=>s.transactions.push({...s.transactions[0],id:'extra'}),
  ({c})=>c.distinctStatementExpense={},
 ]){const x=gmailDistinct();mutate(x);assert.equal(classifyCashflow(x.c,x.s,x.l).action,'review')}
});
test('separate same-amount statement purchases may be identified by receipt',()=>assert.equal(classifyCashflow(distinctExpense(),distinctExpenseSnap()).action,'create'));
test('same-amount statement expense rejects conflicts and extra matches',()=>{for(const patch of [{existingId:'missing'},{existingSourceId:'abc123'},{statementFileId:'wrong'},{evidence:''}]){const c=distinctExpense();Object.assign(c.distinctStatementExpense,patch);assert.equal(classifyCashflow(c,distinctExpenseSnap()).action,'review')}const s=distinctExpenseSnap();s.transactions.push({id:'extra',account:'a',date:'2025-12-15',amount:-999000});assert.equal(classifyCashflow(distinctExpense(),s).action,'review')});
test('distinct expense rejects merchant, date and prior receipt mismatches',()=>{for(const f of [s=>s.transactions[0].date='2025-12-15',s=>s.transactions[0].payee='ms',s=>s.transactions[0].notes='missing']){let s=distinctExpenseSnap();f(s);assert.equal(classifyCashflow(distinctExpense(),s).action,'review')}});

const statementRows=()=>{const s=snap();s.payees.push({id:'transport',name:'Transantiago'});s.categories.push({id:'travel',is_income:false});const old={id:'old',account:'a',date:'2025-03-30',amount:-174000,payee:'transport',category:'travel',notes:null,imported_id:null};s.transactions.push(old);const c={cashflow:true,type:'expense',currency:'CLP',account:'a',date:'2025-03-26',amount:-174000,sourceId:'bank:row-26',sourceIds:[],driveFileIds:['statement1'],evidence:'Inspected account and each row in statement',notes:'BipQR',category:'travel',payeeName:'Transantiago',distinctStatementRows:{statementFileId:'statement1',statementDescriptor:'Mercadopago *bipqr',evidence:'Distinct dated rows verified on the same statement',matches:[{statementDate:'2025-03-30',transaction:structuredClone(old)}]}};return {s,c}};
test('same-merchant statement rows on different dates pass exact duplicate checks',()=>{const {s,c}=statementRows();assert.equal(classifyCashflow(c,s).action,'create')});
test('same-merchant statement exception accounts for every nearby matching row',()=>{const {s,c}=statementRows();const second={...s.transactions[0],id:'old2',date:'2025-03-27'};s.transactions.push(second);assert.equal(classifyCashflow(c,s).action,'review');c.distinctStatementRows.matches.push({statementDate:second.date,transaction:structuredClone(second)});assert.equal(classifyCashflow(c,s).action,'create')});
test('same-merchant statement exception rejects stale, missing, same-day or inexact evidence',()=>{for(const mutate of [({c})=>c.distinctStatementRows.statementFileId='elsewhere',({c})=>c.distinctStatementRows.evidence='',({c})=>c.distinctStatementRows.statementDescriptor='',({c})=>c.distinctStatementRows.matches=[],({c})=>c.distinctStatementRows.matches[0].statementDate=c.date,({s})=>s.transactions[0].notes='changed',({s})=>s.transactions[0].category='other',({s})=>s.transactions[0].payee='different',({s})=>s.transactions[0].is_parent=true,({s})=>s.transactions.push({...s.transactions[0],id:'additional'})]){const x=statementRows();mutate(x);assert.equal(classifyCashflow(x.c,x.s).action,'review')}});
test('same-merchant statement expense is idempotent on exact retry',()=>{const {s,c}=statementRows();s.transactions.push({id:'new',account:'a',date:c.date,amount:c.amount,payee:'transport',category:'travel',imported_id:c.sourceId,notes:'BipQR\nhttps://drive.google.com/file/d/statement1/view\nsource=bank:row-26'});assert.equal(classifyCashflow(c,s).action,'existing')});
const legacyRows=()=>{const s=snap();s.payees.push({id:'xbox',name:'Microsoft'},{id:'meli',name:'Meli'});s.categories.push({id:'games',is_income:false},{id:'media',is_income:false});const old={id:'old',account:'a',date:'2025-09-13',amount:-799000,payee:'xbox',category:'games',notes:'Xbox',imported_id:null,is_parent:false,is_child:false,transfer_id:null};s.transactions.push(old);const c={cashflow:true,type:'expense',currency:'CLP',account:'a',date:'2025-09-17',amount:-799000,sourceId:'bank:melimas:20250917',sourceIds:[],driveFileIds:['statement1'],evidence:'Inspected both distinct statement rows and previous receipt',notes:'Meli subscription',category:'media',payeeName:'Meli',distinctLegacyStatementExpense:{statementFileId:'statement1',existingReceiptId:'abcdef0123456789',newStatementDescriptor:'Merpago melimas',existingStatementDescriptor:'Microsoft Store',existingTransaction:structuredClone(old),evidence:'Same statement shows two different merchant charges and the prior receipt matches Xbox'}};return {s,c}};
test('separate statement row can coexist with exact different-merchant legacy transaction and prior receipt',()=>{const {s,c}=legacyRows();assert.equal(classifyCashflow(c,s).action,'create')});
test('legacy statement exception fails closed for stale or insufficient evidence',()=>{for(const mutate of [({c})=>c.distinctLegacyStatementExpense.statementFileId='other',({c})=>c.distinctLegacyStatementExpense.existingReceiptId='',({c})=>c.distinctLegacyStatementExpense.evidence='',({c})=>c.distinctLegacyStatementExpense.newStatementDescriptor='Microsoft Store',({s})=>s.transactions[0].notes='changed',({s,c})=>{s.transactions[0].date=c.date;c.distinctLegacyStatementExpense.existingTransaction.date=c.date},({s,c})=>{s.transactions[0].payee='meli';c.distinctLegacyStatementExpense.existingTransaction.payee='meli'},({s,c})=>{s.transactions[0].imported_id='bank:existing';c.distinctLegacyStatementExpense.existingTransaction.imported_id='bank:existing'},({s})=>s.transactions.push({...s.transactions[0],id:'extra'})]){const x=legacyRows();mutate(x);assert.equal(classifyCashflow(x.c,x.s).action,'review')}});
test('legacy statement retry independently verifies exact prior and existing new transaction',()=>{const {s,c}=legacyRows();s.transactions.push({id:'new',account:'a',date:c.date,amount:c.amount,payee:'meli',category:'media',imported_id:c.sourceId,notes:'Meli subscription\nhttps://drive.google.com/file/d/statement1/view\nsource=bank:melimas:20250917'});assert.equal(classifyCashflow(c,s).action,'existing')});

const annotatedLegacy=()=>{
 const s=snap();s.payees.push({id:'shop',name:'Shop'});s.categories.push({id:'food',is_income:false});
 const old={id:'old',account:'a',date:'2025-12-07',amount:-600000,payee:null,category:'food',notes:'Six beers bought on trip',imported_id:null,transfer_id:null,is_parent:false,is_child:false};s.transactions.push(old);
 const c={cashflow:true,type:'expense',currency:'CLP',account:'a',date:'2025-12-11',amount:-600000,sourceId:'bank:new-row',sourceIds:[],driveFileIds:['statement1'],evidence:'The complete statement and legacy notes independently inspected',notes:'Shop purchase',category:null,categoryReason:'Items unknown',payeeName:'Shop',distinctAnnotatedLegacyRows:{statementFileId:'statement1',existingStatementDate:'2025-12-07',existingStatementDescriptor:'Seven Eleven',newStatementDescriptor:'Shop',existingTransaction:structuredClone(old),evidence:'Separate rows and exact prior entry verified'}};
 return {s,c};
};
test('separate statement row accepts exact annotated legacy match without fabricated receipt',()=>{const {s,c}=annotatedLegacy();assert.equal(classifyCashflow(c,s).action,'create')});
test('annotated legacy exception rejects stale identity, missing notes, same merchant, incomplete rows and additional matches',()=>{for(const mutate of [({c})=>c.distinctAnnotatedLegacyRows.statementFileId='other',({c})=>c.distinctAnnotatedLegacyRows.evidence='',({c})=>c.distinctAnnotatedLegacyRows.existingStatementDate='2025-12-08',({c})=>c.distinctAnnotatedLegacyRows.newStatementDescriptor='Seven Eleven',({s,c})=>{s.transactions[0].notes='';c.distinctAnnotatedLegacyRows.existingTransaction.notes=''},({s})=>s.transactions[0].notes='changed',({s,c})=>{s.transactions[0].date=c.date;c.distinctAnnotatedLegacyRows.existingTransaction.date=c.date},({s,c})=>{s.transactions[0].imported_id='bank:prior';c.distinctAnnotatedLegacyRows.existingTransaction.imported_id='bank:prior'},({s,c})=>{s.transactions[0].payee='shop';c.distinctAnnotatedLegacyRows.existingTransaction.payee='shop'},({s})=>s.transactions.push({...s.transactions[0],id:'extra'}),({c})=>c.distinctStatementExpense={existingId:'old'}]){const x=annotatedLegacy();mutate(x);assert.equal(classifyCashflow(x.c,x.s).action,'review')}});

const verifiedRows=()=>{
 const s=snap();s.payees.push({id:'one',name:'Ricuras de San Diego'},{id:'two',name:'Rene Moragues'},{id:'shop',name:'Sumup * Los Campos Spa'});s.categories.push({id:'food',is_income:false});
 const tx=(id,date,payee,category)=>({id,account:'a',date,amount:-600000,payee,category,notes:'https://drive.google.com/file/d/statement1/view\nsource=bank:'+id,imported_id:'bank:'+id,transfer_id:null,is_parent:false,is_child:false});
 const a=tx('old1','2025-08-21','one','food'),b=tx('old2','2025-08-28','two',null);s.transactions.push(a,b);
 const l={cashflows:Object.fromEntries([a,b].map(t=>[t.imported_id,{type:'expense',id:t.id,currency:'CLP',account:t.account,date:t.date,amount:t.amount,category:t.category,status:t.category?'registered':'review',driveFileIds:['statement1'],verifiedAt:'2026-01-01T00:00:00Z'}]))};
 const c={cashflow:true,type:'expense',currency:'CLP',account:'a',date:'2025-08-24',amount:-600000,sourceId:'bank:new',sourceIds:[],driveFileIds:['statement1'],evidence:'Complete statement checked',notes:'Purchase',category:null,categoryReason:'Items unknown',payeeName:'Sumup * Los Campos Spa',distinctVerifiedStatementMatches:{statementFileId:'statement1',newStatementDescriptor:'Sumup * Los Campos Spa',evidence:'Three different merchant rows and both verified ledger entries',matches:[{statementDescriptor:'Ricuras de San Dieg',transaction:structuredClone(a)},{statementDescriptor:'Rene Moragues',transaction:structuredClone(b)}]}};
 return {s,c,l};
};
test('multiple independently verified statement rows admit one distinct uncategorized purchase',()=>{const {s,c,l}=verifiedRows();assert.equal(classifyCashflow(c,s,l).action,'create')});
test('verified statement matches fail closed for stale or incomplete evidence',()=>{for(const mutate of [({c})=>c.distinctVerifiedStatementMatches.statementFileId='bad',({c})=>c.distinctVerifiedStatementMatches.matches.pop(),({c})=>c.distinctVerifiedStatementMatches.matches[0].statementDescriptor='Rene Moragues',({c})=>c.distinctVerifiedStatementMatches.newStatementDescriptor='other',({l})=>delete l.cashflows['bank:old1'],({l})=>l.cashflows['bank:old1'].status='superseded-duplicate',({l})=>l.cashflows['bank:old1'].driveFileIds=[],({s})=>s.transactions[0].notes='changed',({s})=>s.transactions.push({...s.transactions[0],id:'extra'}),({s,c,l})=>{s.transactions[0].date=c.date;c.distinctVerifiedStatementMatches.matches[0].transaction.date=c.date;l.cashflows['bank:old1'].date=c.date},({c})=>c.distinctAnnotatedLegacyRows={}]){const x=verifiedRows();mutate(x);assert.equal(classifyCashflow(x.c,x.s,x.l).action,'review')}});

const sameDayVerified=()=>{
 const {s,c,l}=verifiedRows();delete c.distinctVerifiedStatementMatches;s.transactions=[s.transactions[0]];
 const t=s.transactions[0];t.date=c.date;l.cashflows[t.imported_id].date=c.date;delete l.cashflows['bank:old2'];
 c.payeeName='New Merchant';c.distinctSameDayStatementExpense={statementFileId:'statement1',priorMerchant:'Ricuras de San Diego',newMerchant:'New Merchant',priorTransaction:structuredClone(t),evidence:'Full statement identifies two distinct merchant rows.'};
 return {s,c,l};
};
test('distinct same-day statement expense admits exactly one verified prior merchant',()=>{const {s,c,l}=sameDayVerified();const r=classifyCashflow(c,s,l);assert.equal(r.action,'create');assert.equal(r.payeeAction,'create');assert.equal(r.label,'Actual/Review')});
test('same-day exception fails closed on source, prior, merchant, date and conflict mismatches',()=>{for(const mutate of [
 ({c})=>c.distinctSameDayStatementExpense.statementFileId='other',
 ({c})=>c.distinctSameDayStatementExpense.evidence='',
 ({c})=>c.distinctSameDayStatementExpense.priorMerchant='New Merchant',
 ({c})=>c.distinctSameDayStatementExpense.newMerchant='Different',
 ({c})=>c.distinctSameDayStatementExpense.priorTransaction.date='2025-08-23',
 ({s})=>s.transactions[0].notes='changed',
 ({l})=>delete l.cashflows['bank:old1'],
 ({l})=>l.cashflows['bank:old1'].verifiedAt=null,
 ({l})=>l.cashflows['bank:old1'].driveFileIds=[],
 ({c,l})=>{c.sourceIds=['abcdef'];l.cashflows['bank:old1'].sourceIds=['abcdef']},
 ({c})=>{c.payeeName='Ricuras-de San Diego';c.distinctSameDayStatementExpense.newMerchant=c.payeeName},
 ({s,c,l})=>{c.date='2025-02-30';s.transactions[0].date=c.date;c.distinctSameDayStatementExpense.priorTransaction.date=c.date;l.cashflows['bank:old1'].date=c.date},
 ({s})=>s.transactions.push({...s.transactions[0],id:'extra'}),
 ({c})=>c.distinctStatementRows={},
 ({c})=>c.categoryReason='',
]){const x=sameDayVerified();mutate(x);assert.equal(classifyCashflow(x.c,x.s,x.l).action,'review')}});

const identicalRows=()=>{
 const s=snap();s.payees.push({id:'shop',name:'Shop'});const source='bank:test:row1of2';
 const old={id:'old',account:'a',date:'2025-08-24',amount:-400000,payee:'shop',category:null,notes:'https://drive.google.com/file/d/statement1/view\nsource='+source,imported_id:source,transfer_id:null,is_parent:false,is_child:false};s.transactions.push(old);
 const l={cashflows:{[source]:{type:'expense',id:'old',currency:'CLP',account:'a',date:old.date,amount:old.amount,category:null,status:'review',driveFileIds:['statement1'],sourceIds:[],verifiedAt:'2026-01-01T00:00:00Z'}}};
 const c={cashflow:true,type:'expense',currency:'CLP',account:'a',date:old.date,amount:old.amount,sourceId:'bank:test:row2of2',sourceIds:[],driveFileIds:['statement1'],evidence:'Inspected complete statement and two distinct rows.',notes:'Second row',category:null,categoryReason:'Items unknown',payeeName:'Shop',distinctIdenticalStatementRows:{statementFileId:'statement1',priorTransaction:structuredClone(old),rowCount:2,priorOrdinal:1,newOrdinal:2,evidence:'Two rows corroborated by complete statement totals.',accounting:{previousBill:10000000,payments:2000000,operations:5000000,financeCharges:100000,currentBill:13100000}}};return{s,c,l};
};
test('two identical rows require verified prior ledger and corroborating arithmetic',()=>{const {s,c,l}=identicalRows();const r=classifyCashflow(c,s,l);assert.equal(r.action,'create');assert.equal(r.label,'Actual/Review')});
test('identical row exception rejects missing corroboration, stale identity and extra matches',()=>{for(const mutate of [
 ({c})=>c.distinctIdenticalStatementRows.rowCount=3,({c})=>c.distinctIdenticalStatementRows.newOrdinal=1,
 ({c})=>c.distinctIdenticalStatementRows.accounting.currentBill+=1001,({c})=>c.distinctIdenticalStatementRows.accounting.operations-=400000,
 ({c})=>c.distinctIdenticalStatementRows.accounting.payments=-1,({c})=>c.sourceId='bank:other:row2of2',({c})=>c.distinctIdenticalStatementRows.evidence='',
 ({l})=>delete l.cashflows['bank:test:row1of2'],({l})=>l.cashflows['bank:test:row1of2'].verifiedAt=null,
 ({s})=>s.transactions[0].notes='changed',({s})=>s.transactions.push({...s.transactions[0],id:'extra'}),({c})=>c.distinctStatementRows={}
]){const {s,c,l}=identicalRows();mutate({s,c,l});assert.equal(classifyCashflow(c,s,l).action,'review')}});

const concurrentVerified=()=>{
 const {s,c,l}=verifiedRows();const b=s.transactions[1];b.date=s.transactions[0].date;l.cashflows[b.imported_id].date=b.date;
 c.payeeName='New Transit';c.sourceIds=['abcdef0123456789'];c.distinctVerifiedStatementMatches.newStatementDescriptor=c.payeeName;c.distinctVerifiedStatementMatches.matches[1].transaction=structuredClone(b);
 return {s,c,l};
};
test('verified different merchants may share a prior date with a safely created new payee',()=>{const {s,c,l}=concurrentVerified();const r=classifyCashflow(c,s,l);assert.equal(r.action,'create');assert.equal(r.payeeAction,'create');assert.equal(r.label,'Actual/Review')});
test('concurrent verified prior rows reject reused evidence, stale data and unexplained matches',()=>{for(const mutate of [
 ({c,l})=>{l.cashflows['bank:old1'].sourceIds=[c.sourceIds[0]]},
 ({c})=>c.distinctVerifiedStatementMatches.matches[1].statementDescriptor='Ricuras de San Dieg',
 ({s,c,l})=>{s.transactions[0].date=c.date;c.distinctVerifiedStatementMatches.matches[0].transaction.date=c.date;l.cashflows['bank:old1'].date=c.date},
 ({s})=>s.transactions.push({...s.transactions[0],id:'extra'}),
 ({l})=>l.cashflows['bank:old2'].verifiedAt=null,
]){const x=concurrentVerified();mutate(x);assert.equal(classifyCashflow(x.c,x.s,x.l).action,'review')}});

const expense=()=>({cashflow:true,type:'expense',currency:'CLP',account:'a',date:'2025-01-15',amount:-12300,sourceId:'bank:newmerchant',sourceIds:[],driveFileIds:['stmt123'],evidence:'Verified settled statement row',notes:'Verified purchase',category:'expense',payeeName:'New Merchant'});
const expenseSnap=()=>{const s=snap();s.categories.push({id:'expense',is_income:false,hidden:false});return {...s,rules:[],schedules:[],balances:{a:0,b:0}}};
test('preview shows creation of an absent exact merchant',()=>assert.equal(classifyCashflow(expense(),expenseSnap()).payeeAction,'create'));
test('preview rejects case and whitespace-equivalent merchants and transfer-name collisions',()=>{for(const p of [{id:'x',name:' new merchant '},{id:'x',name:'NEW MERCHANT'},{id:'x',name:'New Merchant',transfer_acct:'b'}]){const s=expenseSnap();s.payees.push(p);assert.equal(classifyCashflow(expense(),s).action,'review')}});
test('preview reuses one exact ordinary payee',()=>{const s=expenseSnap();s.payees.push({id:'x',name:'New Merchant'});assert.equal(classifyCashflow(expense(),s).payeeAction,'existing')});

function harness({failFirstPost=false,mutateOnBackup=false}={}){
 const state=expenseSnap(),lease={};let created=0,posts=0,backups=0;
 const api={sync:async()=>{},shutdown:async()=>{},createPayee:async({name})=>{created++;const id='new-payee';state.payees.push({id,name});return id},addTransactions:async(account,rows)=>{posts++;if(failFirstPost&&posts===1)throw Error('interrupted');for(const row of rows){state.transactions.push({id:'tx1',account,...row});state.balances[account]+=row.amount}},getTransactions:async()=>structuredClone(state.transactions)};
 const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>{backups++;if(mutateOnBackup)state.categories.push({id:'concurrent'});return '/backup'},requireRun:async()=>lease,readState:async()=>lease,save:async()=>{},json:async()=>{},equal:(a,b,m)=>assert.deepEqual(a,b,m)};
 return {state,ctx,counts:()=>({created,posts,backups})};
}
test('creates a payee only after backup and verifies the transaction independently',async()=>{const h=harness();const r=await cashflow(expense(),true,h.ctx);assert.equal(r.verified,true);assert.equal(r.id,'tx1');assert.deepEqual(h.counts(),{created:1,posts:1,backups:1});assert.equal(h.state.transactions.length,1);assert.equal(h.state.balances.a,-12300)});
test('retry after interruption reuses the already created exact payee and source',async()=>{const h=harness({failFirstPost:true});await assert.rejects(cashflow(expense(),true,h.ctx),/interrupted/);assert.equal(h.state.transactions.length,0);const r=await cashflow(expense(),true,h.ctx);assert.equal(r.verified,true);assert.equal(h.counts().created,1);assert.equal(h.state.transactions.length,1);const retry=await cashflow(expense(),true,h.ctx);assert.equal(retry.action,'existing');assert.equal(h.state.transactions.length,1)});
test('concurrent changes after backup prevent payee creation and posting',async()=>{const h=harness({mutateOnBackup:true});await assert.rejects(cashflow(expense(),true,h.ctx),/Budget changed before cashflow/);assert.equal(h.counts().created,0);assert.equal(h.counts().posts,0)});
test('statement-row write verifies unchanged prior transactions and retry does not duplicate',async()=>{const h=harness(),{s,c}=statementRows();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.categories.push(...s.categories.filter(p=>p.id==='travel'));h.state.transactions.push(...s.transactions);const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.equal(h.state.transactions.length,2);assert.deepEqual(h.state.transactions[0],c.distinctStatementRows.matches[0].transaction);assert.deepEqual(h.counts(),{created:0,posts:1,backups:1});const again=await cashflow(c,true,h.ctx);assert.equal(again.action,'existing');assert.equal(h.state.transactions.length,2);assert.equal(h.counts().posts,1)});
test('legacy statement write preserves prior transaction, audits receipt separately and retries without duplicate',async()=>{const h=harness(),{s,c}=legacyRows();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.categories.push(...s.categories.filter(p=>['games','media'].includes(p.id)));h.state.transactions.push(...s.transactions);let audit;h.ctx.save=async l=>{audit=structuredClone(l)};const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.deepEqual(h.state.transactions[0],c.distinctLegacyStatementExpense.existingTransaction);assert(!h.state.transactions[1].notes.includes(c.distinctLegacyStatementExpense.existingReceiptId));assert.equal(audit.cashflows[c.sourceId].distinctLegacyStatementExpense.existingReceiptId,c.distinctLegacyStatementExpense.existingReceiptId);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.equal(h.counts().posts,1)});
test('annotated legacy write preserves prior, audits evidence and retries without duplicate',async()=>{const h=harness(),{s,c}=annotatedLegacy();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.categories.push(...s.categories.filter(p=>p.id==='food'));h.state.transactions.push(...s.transactions);let audit;h.ctx.save=async l=>{audit=structuredClone(l)};const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.equal(r.label,'Actual/Review');assert.deepEqual(h.state.transactions[0],c.distinctAnnotatedLegacyRows.existingTransaction);assert.deepEqual(audit.cashflows[c.sourceId].distinctAnnotatedLegacyRows,c.distinctAnnotatedLegacyRows);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.equal(h.counts().posts,1)});
test('Gmail-backed prior remains unchanged and exact retry does not create a second statement expense',async()=>{const h=harness(),{s,c,l}=gmailDistinct();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.categories.push(...s.categories.filter(p=>p.id==='sub'));h.state.transactions.push(...s.transactions);h.ctx.requireRun=async()=>l;h.ctx.readState=async()=>l;const first=await cashflow(c,true,h.ctx);assert.equal(first.verified,true);assert.equal(first.label,'Actual/Review');assert.deepEqual(h.state.transactions[0],s.transactions[0]);assert.deepEqual(l.cashflows[c.sourceId].distinctGmailStatementExpense,c.distinctGmailStatementExpense);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.equal(h.counts().posts,1)});
test('multiple verified statement matches preserve both prior entries, audit and retry idempotently',async()=>{const h=harness(),{s,c,l}=verifiedRows();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.categories.push(...s.categories.filter(p=>p.id==='food'));h.state.transactions.push(...s.transactions);h.ctx.requireRun=async()=>l;h.ctx.readState=async()=>l;const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.equal(r.label,'Actual/Review');assert.deepEqual(h.state.transactions.slice(0,2),s.transactions);assert.deepEqual(l.cashflows[c.sourceId].distinctVerifiedStatementMatches,c.distinctVerifiedStatementMatches);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.equal(h.counts().posts,1)});
test('same-day commit preserves prior, audits exception, creates merchant once and retries safely',async()=>{const h=harness(),{s,c,l}=sameDayVerified();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.categories.push(...s.categories.filter(p=>p.id==='food'));h.state.transactions.push(...s.transactions);h.ctx.requireRun=async()=>l;h.ctx.readState=async()=>l;const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.equal(r.label,'Actual/Review');assert.deepEqual(h.state.transactions[0],s.transactions[0]);assert.deepEqual(l.cashflows[c.sourceId].distinctSameDayStatementExpense,c.distinctSameDayStatementExpense);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.deepEqual(h.counts(),{created:1,posts:1,backups:1})});
test('identical same-day rows preserve prior and audit idempotent retry',async()=>{const h=harness(),{s,c,l}=identicalRows();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.transactions.push(...s.transactions);h.ctx.requireRun=async()=>l;h.ctx.readState=async()=>l;const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.equal(r.label,'Actual/Review');assert.deepEqual(h.state.transactions[0],s.transactions[0]);assert.deepEqual(l.cashflows[c.sourceId].distinctIdenticalStatementRows,c.distinctIdenticalStatementRows);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.equal(h.counts().posts,1)});
test('concurrent verified prior rows preserve both records through payee creation and idempotent retry',async()=>{const h=harness(),{s,c,l}=concurrentVerified();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.categories.push(...s.categories.filter(p=>p.id==='food'));h.state.transactions.push(...s.transactions);h.ctx.requireRun=async()=>l;h.ctx.readState=async()=>l;const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.deepEqual(h.state.transactions.slice(0,2),s.transactions);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.deepEqual(h.counts(),{created:1,posts:1,backups:1})});

const legacyLineFixture=(payment=false)=>{
 const line='line',bank='bank',card='card';
 const s={accounts:[{id:line,name:'Línea de Crédito BCH',closed:false},{id:bank,name:'BCH Cta Cte',closed:false},{id:card,name:'BCH Crédito',closed:false}],payees:[{id:'pline',transfer_acct:line},{id:'pbank',transfer_acct:bank},{id:'pcard',transfer_acct:card},{id:'market',name:'Binance'}],categories:[{id:'income',is_income:true}],transactions:[]};
 const previous=payment?{id:'old',account:bank,date:'2022-02-07',amount:-50000000,payee:'pcard',category:null,imported_id:'financisto-csv-old',transfer_id:'other',is_parent:false,is_child:false,notes:'Card payment'}:{id:'old',account:bank,date:'2022-02-08',amount:50000000,payee:'market',category:'income',imported_id:'financisto-csv-old',transfer_id:null,is_parent:false,is_child:false,notes:'Sale'};
 const counterpart=payment?{id:'other',account:card,date:'2022-02-07',amount:50000000,payee:'pbank',category:null,imported_id:'financisto-csv-other',transfer_id:'old',is_parent:false,is_child:false}:null;
 s.transactions.push(structuredClone(previous));if(counterpart)s.transactions.push(structuredClone(counterpart));
 const c={cashflow:true,type:'transfer',currency:'CLP',account:payment?bank:line,destination:payment?line:bank,date:payment?'2022-02-11':'2022-02-10',amount:-50000000,sourceId:'bank:line:123',sourceIds:[],driveFileIds:['statement_123'],evidence:'Bank statement establishes line movement.',counterpartyEvidence:'Same statement confirms own-account line.',notes:'Credit line',distinctLegacyLineMatch:{statementFileId:'statement_123',priorStatementDate:payment?'2022-02-08':'2022-02-09',priorReceiptId:'17edb38d6c47943d',priorStatementDescriptor:payment?'Card payment':'Third party deposit',newStatementDescriptor:payment?'Line payment':'Line draw',priorTransaction:previous,priorCounterpart:counterpart,evidence:'Statement and separate receipt identify different bank rows.'}};
 return {c,s};
};
test('a completed exact account migration preserves verification of the original registered legacy line payment',()=>{
 const {c,s}=legacyLineFixture(true),oldPrior=structuredClone(c.distinctLegacyLineMatch.priorTransaction),oldCounterpart=structuredClone(c.distinctLegacyLineMatch.priorCounterpart);
 s.accounts.push({id:'newcard',name:'Main card',closed:false});s.payees.push({id:'pnewcard',transfer_acct:'newcard'});
 const newPrior={...oldPrior,payee:'pnewcard'},newCounterpart={...oldCounterpart,account:'newcard'};s.transactions=[newPrior,newCounterpart,{id:'new-origin',account:'bank',date:c.date,amount:c.amount,payee:'pline',category:null,transfer_id:'new-destination',imported_id:c.sourceId,notes:'Credit line\nhttps://drive.google.com/file/d/statement_123/view\nsource=bank:line:123'},{id:'new-destination',account:'line',date:c.date,amount:-c.amount,payee:'pbank',category:null,transfer_id:'new-origin'}];
 const mapping={sourceId:c.sourceId,oldPrior,oldCounterpart,newPrior,newCounterpart};const ledger={cashflows:{[c.sourceId]:{status:'registered',verifiedAt:'2026-01-01',id:'new-origin',counterpartId:'new-destination',type:c.type,currency:c.currency,account:c.account,destination:c.destination,date:c.date,amount:c.amount,evidence:c.evidence,counterpartyEvidence:c.counterpartyEvidence,sourceIds:c.sourceIds,driveFileIds:c.driveFileIds,distinctLegacyLineMatch:structuredClone(c.distinctLegacyLineMatch)}},historicalAccountMigrations:{migration1:{status:'complete',backup:'/backup',verifiedAt:'2026-01-01',sourceAccount:'card',destinationAccount:'newcard',legacyLineMappings:[mapping]}}};
 assert.equal(classifyCashflow(c,s,ledger).action,'existing');
 for(const change of [l=>l.historicalAccountMigrations.migration1.status='pending',l=>l.historicalAccountMigrations.migration1.backup='',l=>l.historicalAccountMigrations.migration1.legacyLineMappings[0].oldPrior.amount++,l=>l.historicalAccountMigrations.migration1.legacyLineMappings[0].newCounterpart.amount++,l=>l.historicalAccountMigrations.migration1.legacyLineMappings[0].sourceId='another',l=>l.historicalAccountMigrations.migration1.legacyLineMappings.push(structuredClone(l.historicalAccountMigrations.migration1.legacyLineMappings[0])),l=>l.cashflows[c.sourceId].id='other',l=>l.cashflows[c.sourceId].evidence='other']){const bad=structuredClone(ledger);change(bad);assert.equal(classifyCashflow(c,s,bad).action,'review')}
 const altered=structuredClone(s);altered.transactions[1].amount++;assert.equal(classifyCashflow(c,altered,ledger).action,'review');
});
test('distinct line draw and repayment may bypass only an independently verified legacy match',()=>{for(const payment of [false,true]){const {c,s}=legacyLineFixture(payment);assert.equal(classifyCashflow(c,s).action,'create')}});
test('legacy line exception rejects missing, changed, overlapping or ambiguous evidence',()=>{
 for(const payment of [false,true])for(const mut of [
  ({c})=>c.distinctLegacyLineMatch.priorReceiptId='wrong',
  ({c})=>c.distinctLegacyLineMatch.statementFileId='different',
  ({c})=>c.distinctLegacyLineMatch.priorStatementDate=c.date,
  ({c})=>c.distinctLegacyLineMatch.priorStatementDescriptor=c.distinctLegacyLineMatch.newStatementDescriptor,
  ({c})=>c.distinctLegacyLineMatch.evidence='',
  ({c})=>c.distinctLegacyLineMatch.extra=true,
  ({c})=>c.distinctTransfer={},
  ({s})=>s.transactions[0].amount++,
  ({c})=>c.distinctLegacyLineMatch.priorTransaction.date='2021-01-01',
  ({s,c})=>s.transactions.push({...structuredClone(c.distinctLegacyLineMatch.priorTransaction),id:'another'}),
  ({s})=>{s.accounts[0].name='Other account'},
 ]){const x=legacyLineFixture(payment);mut(x);assert.equal(classifyCashflow(x.c,x.s).action,'review')}
 const x=legacyLineFixture(true);x.c.distinctLegacyLineMatch.priorCounterpart.transfer_id='bad';assert.equal(classifyCashflow(x.c,x.s).action,'review');
});
test('legacy line transfer backs up, preserves prior snapshots, audits evidence and retries without a duplicate',async()=>{
 for(const payment of [false,true]){
  const {s,c}=legacyLineFixture(payment);let state={...structuredClone(s),rules:[],schedules:[],balances:{line:0,bank:0,card:0}},lease={},events=[];
  const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{events.push('write');const row=rows[0],id='new-origin',other='new-destination';state.transactions.push({id,account,...row,transfer_id:other},{id:other,account:c.destination,date:c.date,amount:-c.amount,payee:state.payees.find(p=>p.transfer_acct===c.account).id,category:null,transfer_id:id});state.balances[account]+=c.amount;state.balances[c.destination]-=c.amount},getTransactions:async()=>structuredClone(state.transactions)};
  const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>{events.push('backup');return '/backup'},requireRun:async()=>lease,readState:async()=>lease,save:async()=>{},json:async()=>{},equal:(a,b,m)=>assert.deepEqual(a,b,m)};
  const first=await cashflow(c,true,ctx);assert.equal(first.verified,true);assert.deepEqual(state.transactions.slice(0,s.transactions.length),s.transactions);assert.deepEqual(lease.cashflows[c.sourceId].distinctLegacyLineMatch,c.distinctLegacyLineMatch);assert(!state.transactions.find(x=>x.id==='new-origin').notes.includes(c.distinctLegacyLineMatch.priorReceiptId));
  assert.equal((await cashflow(c,true,ctx)).action,'existing');assert.deepEqual(events,['backup','write']);
 }
});

const verifiedLinePayment=()=>{
 const {c,s}=legacyLineFixture(true),stmt='statement_123';
 const old={id:'prior-origin',account:'bank',date:'2025-01-28',amount:-743600,payee:'pline',category:null,transfer_id:'prior-dest',imported_id:'bank:prior-line',notes:'https://drive.google.com/file/d/statement_123/view\nsource=bank:prior-line'};
 const leg={id:'prior-dest',account:'line',date:'2025-01-28',amount:743600,payee:'pbank',category:null,transfer_id:'prior-origin'};
 s.transactions=[structuredClone(old),structuredClone(leg)];
 Object.assign(c,{date:'2025-01-29',amount:-743600,sourceId:'bank:new-line',sourceIds:['194aeb8bac7da9f9']});delete c.distinctLegacyLineMatch;
 c.distinctVerifiedLinePayment={statementFileId:stmt,priorSource:'bank:prior-line',priorOrigin:old,priorDestination:leg,priorStatementDescriptor:'Automatic amortization',newStatementDescriptor:'Internet payment',evidence:'Statement shows two separate repayment rows on different dates.'};
 const l={cashflows:{'bank:prior-line':{type:'transfer',id:old.id,counterpartId:leg.id,currency:'CLP',account:'bank',destination:'line',date:old.date,amount:old.amount,status:'registered',driveFileIds:[stmt],verifiedAt:'2026-01-01'}}};return{s,c,l};
};
test('verified earlier same-line repayment can be distinguished from a separate statement row',()=>{const {s,c,l}=verifiedLinePayment();assert.equal(classifyCashflow(c,s,l).action,'create')});
test('verified same-line repayment exception rejects stale, incomplete or conflicting evidence',()=>{
 for(const mutate of [
  ({c})=>c.distinctVerifiedLinePayment.statementFileId='bad',
  ({c})=>c.distinctVerifiedLinePayment.priorSource=c.sourceId,
  ({c})=>c.distinctVerifiedLinePayment.priorStatementDescriptor=c.distinctVerifiedLinePayment.newStatementDescriptor,
  ({c})=>c.distinctVerifiedLinePayment.evidence='',
  ({c})=>c.distinctLegacyLineMatch={},
  ({c})=>c.distinctVerifiedLinePayment.extra=true,
  ({s})=>s.transactions[0].amount++,
  ({s})=>s.transactions[1].transfer_id='bad',
  ({l})=>delete l.cashflows['bank:prior-line'],
  ({l})=>l.cashflows['bank:prior-line'].status='review',
  ({l})=>l.cashflows['bank:prior-line'].driveFileIds=[],
  ({s,c})=>s.transactions.push({...structuredClone(c.distinctVerifiedLinePayment.priorOrigin),id:'extra'}),
 ]){const x=verifiedLinePayment();mutate(x);assert.equal(classifyCashflow(x.c,x.s,x.l).action,'review')}
});
test('verified line payment backs up, preserves the prior pair, audits evidence and retries',async()=>{
 const {s,c,l}=verifiedLinePayment();let state={...structuredClone(s),rules:[],schedules:[],balances:{line:0,bank:0,card:0}},events=[];
 const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{events.push('write');const row=rows[0],id='new-origin',other='new-destination';state.transactions.push({id,account,...row,transfer_id:other},{id:other,account:c.destination,date:c.date,amount:-c.amount,payee:state.payees.find(p=>p.transfer_acct===c.account).id,category:null,transfer_id:id});state.balances[account]+=c.amount;state.balances[c.destination]-=c.amount},getTransactions:async()=>structuredClone(state.transactions)};
 const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>{events.push('backup');return '/backup'},requireRun:async()=>l,readState:async()=>l,save:async()=>{},json:async()=>{},equal:(a,b,m)=>assert.deepEqual(a,b,m)};
 const first=await cashflow(c,true,ctx);assert.equal(first.verified,true);assert.deepEqual(state.transactions.slice(0,s.transactions.length),s.transactions);assert.deepEqual(l.cashflows[c.sourceId].distinctVerifiedLinePayment,c.distinctVerifiedLinePayment);assert.equal((await cashflow(c,true,ctx)).action,'existing');assert.deepEqual(events,['backup','write']);
});

const sameOriginFixture=()=>{
 const s=snap();s.accounts.push({id:'c'});s.payees.push({id:'pc',transfer_acct:'c'});
 const prior={id:'prior-origin',account:'a',date:base.date,amount:base.amount,payee:'pc',category:null,transfer_id:'prior-leg',imported_id:null,notes:null};
 const leg={id:'prior-leg',account:'c',date:base.date,amount:-base.amount,payee:'pa',category:null,transfer_id:'prior-origin',imported_id:null,notes:null};
 s.transactions=[structuredClone(prior),structuredClone(leg)];
 const c={...base,sourceIds:[],driveFileIds:['statement123','recipient123'],distinctSameOriginTransfer:{statementFileId:'statement123',recipientFileId:'recipient123',priorOrigin:prior,priorDestination:leg,priorStatementDescriptor:'MACH Webpay',newStatementDescriptor:'Mercado Pago',evidence:'Two separate rows verified against the recipient report.'}};
 return {s,c};
};
test('same-origin distinct transfer accepts a fully evidenced sole prior pair',()=>{const {s,c}=sameOriginFixture();assert.equal(classifyCashflow(c,s).action,'create')});
test('same-origin distinct transfer accepts separately evidenced prior pair on a nearby date',()=>{const {s,c}=sameOriginFixture();for(const t of s.transactions)t.date='2026-09-03';c.distinctSameOriginTransfer.priorOrigin.date='2026-09-03';c.distinctSameOriginTransfer.priorDestination.date='2026-09-03';assert.equal(classifyCashflow(c,s).action,'create')});
test('same-origin distinct transfer rejects invalid or inconsistent prior dates',()=>{for(const dates of [['2026-09-06','2026-09-06'],['2026-09-03','2026-09-04'],['2026-02-30','2026-02-30']]){const {s,c}=sameOriginFixture();s.transactions[0].date=c.distinctSameOriginTransfer.priorOrigin.date=dates[0];s.transactions[1].date=c.distinctSameOriginTransfer.priorDestination.date=dates[1];assert.equal(classifyCashflow(c,s).action,'review')}});
test('same-origin exception fails closed on stale snapshots, sources, payees, destinations or conflict coverage',()=>{
 for(const mutate of [
  ({c})=>c.distinctSameOriginTransfer.statementFileId='wrong',
  ({c})=>c.distinctSameOriginTransfer.recipientFileId='statement123',
  ({c})=>c.distinctSameOriginTransfer.evidence='',
  ({c})=>c.distinctSameOriginTransfer.newStatementDescriptor='MACH Webpay',
  ({c})=>c.distinctSameOriginTransfer.extra=true,
  ({c})=>c.distinctTransfer={},
  ({s})=>s.transactions[0].amount++,
  ({s})=>s.transactions[1].transfer_id='wrong',
  ({s})=>s.transactions[0].payee='wrong',
  ({s})=>s.accounts.find(x=>x.id==='c').closed=true,
  ({s})=>s.transactions.push({id:'extra',account:'b',date:base.date,amount:-base.amount}),
  ({s,c})=>{s.transactions[1].account='b';c.distinctSameOriginTransfer.priorDestination.account='b'},
  ({s,c})=>{s.transactions[0].imported_id=c.sourceId;c.distinctSameOriginTransfer.priorOrigin.imported_id=c.sourceId},
 ]){const x=sameOriginFixture();mutate(x);assert.equal(classifyCashflow(x.c,x.s).action,'review')}
});
test('same-origin transfer preserves prior pair, audits evidence and retries',async()=>{
 const {s,c}=sameOriginFixture();for(const t of s.transactions)t.date='2026-09-03';c.distinctSameOriginTransfer.priorOrigin.date='2026-09-03';c.distinctSameOriginTransfer.priorDestination.date='2026-09-03';let state={...structuredClone(s),rules:[],schedules:[],balances:{a:0,b:0,c:0}},ledger={},events=[];
 const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{events.push('write');const row=rows[0],id='new-origin',other='new-destination';state.transactions.push({id,account,...row,transfer_id:other},{id:other,account:c.destination,date:c.date,amount:-c.amount,payee:'pa',category:null,transfer_id:id});state.balances[account]+=c.amount;state.balances[c.destination]-=c.amount},getTransactions:async()=>structuredClone(state.transactions)};
 const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>{events.push('backup');return '/backup'},requireRun:async()=>ledger,readState:async()=>ledger,save:async()=>{},json:async()=>{},equal:(a,b,m)=>assert.deepEqual(a,b,m)};
 assert.equal((await cashflow(c,true,ctx)).verified,true);assert.deepEqual(state.transactions.slice(0,2),s.transactions);assert.deepEqual(ledger.cashflows[c.sourceId].distinctSameOriginTransfer,c.distinctSameOriginTransfer);assert.equal((await cashflow(c,true,ctx)).action,'existing');assert.deepEqual(events,['backup','write']);
});

const identicalRowsWithOtherMerchant=()=>{
 const {s,c,l}=identicalRows();
 s.payees.push({id:'transit',name:'Transit'});
 const other={id:'other',account:'a',date:c.date,amount:c.amount,payee:'transit',category:null,notes:'https://drive.google.com/file/d/statement1/view\nsource=bank:transit',imported_id:'bank:transit',transfer_id:null,is_parent:false,is_child:false};
 s.transactions.push(other);
 l.cashflows[other.imported_id]={type:'expense',id:other.id,currency:'CLP',account:'a',date:c.date,amount:c.amount,category:null,status:'review',driveFileIds:['statement1'],sourceIds:[],verifiedAt:'2026-01-01T00:00:00Z'};
 c.distinctIdenticalStatementRows.otherMerchant={priorTransaction:structuredClone(other),priorMerchant:'Transit',evidence:'The complete statement identifies a separate transit charge.'};
 return {s,c,l};
};
test('identical statement row accepts independently verified different merchant same day',()=>{const {s,c,l}=identicalRowsWithOtherMerchant();assert.equal(classifyCashflow(c,s,l).action,'create')});
test('identical rows with other merchant fail closed on missing or conflicting evidence',()=>{for(const mutate of [
 ({c})=>delete c.distinctIdenticalStatementRows.otherMerchant,
 ({c})=>c.distinctIdenticalStatementRows.otherMerchant.priorMerchant='Shop',
 ({c})=>c.distinctIdenticalStatementRows.otherMerchant.evidence='',
 ({c})=>c.distinctIdenticalStatementRows.otherMerchant.priorTransaction.date='2025-08-23',
 ({s})=>s.transactions[1].notes='changed',
 ({l})=>delete l.cashflows['bank:transit'],
 ({l})=>l.cashflows['bank:transit'].driveFileIds=[],
 ({l})=>l.cashflows['bank:transit'].verifiedAt=null,
 ({s})=>s.transactions.push({...s.transactions[1],id:'extra'}),
 ({c,l})=>{c.sourceIds=['abcdef'];l.cashflows['bank:transit'].sourceIds=['abcdef']},
]){const x=identicalRowsWithOtherMerchant();mutate(x);assert.equal(classifyCashflow(x.c,x.s,x.l).action,'review')}});
test('identical row with other merchant preserves both, audits, and retries idempotently',async()=>{const h=harness(),{s,c,l}=identicalRowsWithOtherMerchant();h.state.payees.push(...s.payees.filter(p=>p.name));h.state.transactions.push(...s.transactions);h.ctx.requireRun=async()=>l;h.ctx.readState=async()=>l;const r=await cashflow(c,true,h.ctx);assert.equal(r.verified,true);assert.deepEqual(h.state.transactions.slice(0,2),s.transactions);assert.deepEqual(l.cashflows[c.sourceId].distinctIdenticalStatementRows,c.distinctIdenticalStatementRows);assert.equal((await cashflow(c,true,h.ctx)).action,'existing');assert.deepEqual(h.counts(),{created:0,posts:1,backups:1})});

const verifiedSameOriginFixture=()=>{
 const {s,c}=sameOriginFixture(),d=c.distinctSameOriginTransfer;
 const previous='bank:prior';
 for(const t of s.transactions){t.date='2026-09-03';t.notes='Prior transfer\nhttps://mail.google.com/mail/u/0/#all/def\nsource='+previous;}
 s.transactions[0].imported_id=previous;
 d.priorOrigin=structuredClone(s.transactions[0]);d.priorDestination=structuredClone(s.transactions[1]);d.priorSource=previous;
 const l={cashflows:{[previous]:{type:'transfer',id:'prior-origin',counterpartId:'prior-leg',currency:'CLP',account:'a',destination:'c',date:'2026-09-03',amount:base.amount,status:'registered',backup:'/backup',verifiedAt:'2026-09-03T00:00:00Z',sourceIds:['def'],driveFileIds:[]}}};
 return {s,c,l};
};
test('same-origin exception accepts a separately evidenced verified ledger pair',()=>{const {s,c,l}=verifiedSameOriginFixture();assert.equal(classifyCashflow(c,s,l).action,'create')});
test('same-origin verified exception fails closed for inconsistent ledger, sources, dates or conflicts',()=>{
 for(const mutate of [
  ({l})=>delete l.cashflows['bank:prior'],
  ({l})=>l.cashflows['bank:prior'].verifiedAt=null,
  ({l})=>l.cashflows['bank:prior'].status='review',
  ({l})=>l.cashflows['bank:prior'].id='other',
  ({l})=>l.cashflows['bank:prior'].destination='b',
  ({l})=>l.cashflows['bank:prior'].sourceIds=[],
  ({l})=>l.cashflows['bank:prior'].sourceIds=['abc'],
  ({c})=>c.sourceIds=['def'],
  ({c})=>c.distinctSameOriginTransfer.priorSource=c.sourceId,
  ({s})=>s.transactions[0].notes='changed',
  ({s,c})=>{s.transactions[1].notes='missing receipt';c.distinctSameOriginTransfer.priorDestination.notes='missing receipt'},
  ({s,c})=>{s.transactions[0].imported_id='bank:other';c.distinctSameOriginTransfer.priorOrigin.imported_id='bank:other'},
  ({s})=>s.transactions.push({id:'extra',account:'a',date:base.date,amount:base.amount}),
 ]){const x=verifiedSameOriginFixture();mutate(x);assert.equal(classifyCashflow(x.c,x.s,x.l).action,'review')}
});
test('verified same-origin transfer preserves prior pair, audits and retries without a duplicate',async()=>{
 const {s,c,l}=verifiedSameOriginFixture();let state={...structuredClone(s),rules:[],schedules:[],balances:{a:0,b:0,c:0}},events=[];
 const api={sync:async()=>{},shutdown:async()=>{},addTransactions:async(account,rows)=>{events.push('write');const row=rows[0],id='new-origin',other='new-destination';state.transactions.push({id,account,...row,transfer_id:other},{id:other,account:c.destination,date:c.date,amount:-c.amount,payee:'pa',category:null,transfer_id:id});state.balances[account]+=c.amount;state.balances[c.destination]-=c.amount},getTransactions:async()=>structuredClone(state.transactions)};
 const ctx={budgets:{CLP:{syncId:'budget'}},connect:async()=>({api}),snapshot:async()=>structuredClone(state),backup:async()=>{events.push('backup');return '/backup'},requireRun:async()=>l,readState:async()=>l,save:async()=>{},json:async()=>{},equal:(a,b,m)=>assert.deepEqual(a,b,m)};
 assert.equal((await cashflow(c,true,ctx)).verified,true);assert.deepEqual(state.transactions.slice(0,2),s.transactions);assert.deepEqual(l.cashflows[c.sourceId].distinctSameOriginTransfer,c.distinctSameOriginTransfer);assert.equal((await cashflow(c,true,ctx)).action,'existing');assert.deepEqual(events,['backup','write']);
});
