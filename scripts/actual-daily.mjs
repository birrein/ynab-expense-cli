#!/usr/bin/env node
// Operational Actual adapter. Financial payloads and credentials stay outside Git.
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { prefixNoteTags } from './actual-note-tags.mjs';
import { amendTransactionNotes } from './actual-transaction-notes.mjs';
import { amendHistoricalTag } from './actual-historical-tags.mjs';
import { pendingStatementCreditConflict, reservedStatementCreditConflict } from './actual-statement-credit.mjs';
import { BUDGETS, candidateImportedId, candidateSourceNotes, candidateTransactionNotes, validateRefund, validateCandidate, classifyCandidate, verifyTransaction, validateResolution, nextWindows, locateCreatedTransaction, applySimplePayeeCategoryRule, validateInstallmentPlan, classifyInstallmentPlan, validateRemainingInstallmentPlan, classifyRemainingInstallmentPlan, validateRemainingInstallmentsPlan, classifyRemainingInstallmentsPlan, installmentScheduleName, validateScheduleAmendment, classifyScheduleAmendment, validateScheduleNotesAmendment, classifyScheduleNotesAmendment } from './actual-daily-policy.mjs';
const root=process.env.ACTUAL_DAILY_DIR||'/Users/birrein/Actual-pilot/daily', statePath=root+'/state.json';
const apiPath=new URL('./actual-runtime/node_modules/@actual-app/api/dist/index.js',import.meta.url).href;
const [command,...args]=process.argv.slice(2);
// Only directories created by this process are eligible for successful-run cleanup.
const temporaryClients=[];
const option=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
const json=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n',{mode:0o600});
await mkdir(root,{recursive:true,mode:0o700});
const state=()=>readJSON(statePath);
async function save(s){const p=statePath+'.'+randomUUID();await json(p,s);await rename(p,statePath);}
async function locked(fn){
 const lock=root+'/write.lock';
 await mkdir(lock,{mode:0o700}); // EEXIST is a hard stop, never silently steal a lock.
 try{return await fn();}finally{await rm(lock,{recursive:true});}
}
async function requireRun(){const s=await state();assert(s.activeRun&&s.activeRun.id===option('--run-id'),'Run lease missing or owned by another execution');return s;}
function assertNoPendingCrossCurrencyDebt(s){assert(!Object.values(s.crossCurrencyDebtTransfers??{}).some(x=>x?.status==='pending'),'Pending cross-currency debt transfer requires investigation');assert(!Object.values(s.transferPostingDateCorrections??{}).some(x=>x?.status==='pending'),'Pending transfer posting date correction requires investigation');assert(!Object.values(s.ownedTransferPostingDateCorrections??{}).some(x=>x?.status==='pending'),'Pending owned transfer posting date correction requires investigation');assert(!Object.values(s.incomeStatementDateCorrections??{}).some(x=>x?.status==='pending'),'Pending income statement date correction requires investigation');assert(!Object.values(s.expenseStatementDateCorrections??{}).some(x=>x?.status==='pending'),'Pending expense statement date correction requires investigation');assert(!pendingStatementCreditConflict(s),'Pending statement credit requires investigation');}
async function connect(syncId){
 const api=await import(apiPath);
 const token=execFileSync('/usr/bin/security',['find-generic-password','-a','actual-server','-s','actual-budget-session-token','-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const dataDir=await mkdtemp(root+'/client-');
 temporaryClients.push(dataDir);
 const rt=await api.init({serverURL:process.env.ACTUAL_SERVER_URL||'http://127.0.0.1:5006',sessionToken:token,dataDir});
 try{if(syncId)await api.downloadBudget(syncId);}catch(e){await api.shutdown();throw e;}
 return {api,rt};
}
async function snapshot(api){
 const accounts=await api.getAccounts(),transactions=[];
 for(const a of accounts)transactions.push(...await api.getTransactions(a.id,'1900-01-01','2100-01-01'));
 const balances={};for(const a of accounts)balances[a.id]=await api.getAccountBalance(a.id,'2100-01-01');
 return {accounts,transactions,categories:await api.getCategories(),payees:await api.getPayees(),rules:await api.getRules(),schedules:await api.getSchedules(),balances};
}
async function backup(api,currency,before){
 const dir=root+'/backups/'+Date.now()+'-'+currency;await mkdir(dir,{recursive:true,mode:0o700});
 await writeFile(dir+'/budget.zip',await api.exportBudget(),{mode:0o600,flag:'wx'});
 await json(dir+'/before.json',before);return dir;
}
async function readSeriesBackup(dir,currency){
 assert(typeof dir==='string'&&dir.startsWith(root+'/backups/')&&new RegExp('^[0-9]+-'+currency+'$').test(dir.slice((root+'/backups/').length)),'Invalid backup directory');
 const {realpath,stat}=await import('node:fs/promises');assert.equal(await realpath(dir),dir,'Backup path is not canonical');assert((await stat(dir+'/budget.zip')).isFile(),'Original budget backup missing');
 return {before:await readJSON(dir+'/before.json'),candidate:(await readJSON(dir+'/installment-series-dates.json')).candidate};
}
async function writeRecoverySnapshot(dir,s){
 const path=dir+'/recovered-after.json';try{await writeFile(path,JSON.stringify(s,null,2)+'\n',{mode:0o600,flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e;equal(await readJSON(path),s,'Prior recovery snapshot differs')}
}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const equal=(a,b,msg)=>assert.deepEqual(canonical(a),canonical(b),msg);
function validateLive(c,s){
 assert(s.accounts.some(a=>a.id===c.account&&!a.closed&&!a.offbudget),'Account missing/closed/offbudget');
 const cats=[c.category,...(c.splits??[]).map(x=>x.category)].filter(Boolean);
 for(const id of cats)assert(s.categories.some(x=>x.id===id&&!x.hidden),'Unknown/hidden category');
}
async function financial(c,commit){
 if(commit)assertNoPendingCrossCurrencyDebt(await requireRun());
 {const l=commit?await requireRun():await state();if(Object.keys(l.crossAccountGmailDuplicates??{}).length){const m=await import('./actual-cross-account-gmail-dedup.mjs');if(commit)assert(!m.hasPendingGmailDedup(l),'Pending Gmail duplicate requires investigation');if(!Object.hasOwn(c,'crossAccountGmailDedup')&&m.gmailDedupSourceConflict(c,l))return {action:'review',reason:'Source or transaction belongs to a retired Gmail duplicate'};}}
 if(Object.hasOwn(c,'crossAccountGmailDedup'))return (await import('./actual-cross-account-gmail-dedup.mjs')).retireCrossAccountGmailDedup(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(commit)assertNoPendingCrossCurrencyDebt(await requireRun());
 {const l=commit?await requireRun():await state();if(!Object.hasOwn(c,'statementCredit')&&!Object.hasOwn(c,'statementCreditResolution')&&reservedStatementCreditConflict(c,l))return {action:'review',reason:'Source or transaction belongs to statement credit'};}
 {const l=commit?await requireRun():await state(),m=await import('./actual-statement-fx-expense.mjs');if(commit)assert(!m.hasPendingFxExpenseMigration(l),'Pending FX expense migration requires investigation');if(!Object.hasOwn(c,'statementFxExpenseMigration')&&m.migrationSourceConflict(c,l))return {action:'review',reason:'Source or transaction belongs to completed cross-budget expense migration'};}
 {const l=commit?await requireRun():await state();if(Object.keys(l.mixedUberCashSplits??{}).length){const m=await import('./actual-uber-mixed-split.mjs');if(commit)assert(!m.hasPendingMixedSplit(l),'Pending mixed Uber Cash split requires investigation');if(!Object.hasOwn(c,'mixedUberCashSplit')&&m.mixedSplitSourceConflict(c,l))return {action:'review',reason:'Source or transaction belongs to mixed Uber Cash split'};}}
 {const l=commit?await requireRun():await state();const m=await import('./actual-uber-mixed-component.mjs');if(commit)assert(!m.hasPendingMixedComponent(l),'Pending mixed Uber Cash component requires investigation');if(!Object.hasOwn(c,'mixedUberCashComponent')&&!Object.hasOwn(c,'mixedUberCashNoteAmendment')&&m.mixedComponentSourceConflict(c,l))return {action:'review',reason:'Source or transaction belongs to mixed Uber Cash component'};}
 if(commit){const l=await requireRun();assert(!Object.values(l.uberSplitDuplicates??{}).some(x=>x?.status==='pending'),'Pending Uber split retirement requires investigation');assert(!Object.values(l.historicalTwinSplitDeduplications??{}).some(x=>x?.status==='pending'),'Pending twin split retirement requires investigation');assert(!Object.values(l.crossAccountRefundOverlaps??{}).some(x=>x?.status==='pending'),'Pending cross-account refund overlap requires investigation');assert(!Object.values(l.providerRideDedups??{}).some(x=>x?.status==='pending'),'Pending provider ride retirement requires investigation');assert(!Object.values(l.uberCashReconstructions??{}).some(x=>x?.status==='pending'),'Pending Uber Cash reconstruction requires investigation');assert(!(await import('./actual-partial-account-migration.mjs')).hasPendingPartialMigration(l),'Pending historical account migration requires investigation');}
 {const l=commit?await requireRun():await state();if(!Object.hasOwn(c,'marketplaceHeldRefund')&&Object.keys(l.marketplaceHeldRefunds??{}).length&&(await import('./actual-marketplace-held-refund.mjs')).heldRefundSourceConflict(c,l))return {action:'review',reason:'Source reserved by marketplace held refund'};}
 {const l=commit?await requireRun():await state();if(!Object.hasOwn(c,'partialHistoricalIncomeDedup')&&Object.values(l.partialHistoricalIncomeDedups??{}).some(x=>x?.status==='pending')&&(await import('./actual-partial-income-dedup.mjs')).pendingPartialIncomeConflict(c,l))return {action:'review',reason:'Source reserved by pending income adjustment'};}
 {const l=commit?await requireRun():await state();if(!Object.hasOwn(c,'marketplaceSaleTransfer')&&Object.keys(l.marketplaceSaleTransfers??{}).length&&(await import('./actual-marketplace-sale-transfer.mjs')).marketplaceSourceConflict(c,l))return {action:'review',reason:'Source reserved by marketplace sale transfer'};if(Object.values(l.distinctInterestIntents??{}).some(x=>x?.status==='pending')&&(await import('./actual-cashflow.mjs')).pendingInterestSourceConflict(c,l))return {action:'review',reason:'Source reserved by pending interest intent'};if(!Object.hasOwn(c,'crossAccountStatementRefund')&&!Object.hasOwn(c,'linkedRefundCategoryResolution')&&Object.values(l.crossAccountStatementRefunds??{}).some(x=>['pending','registered-pending-category'].includes(x?.status))&&(await import('./actual-linked-refund-category.mjs')).pendingRefundPairConflict(c,l))return {action:'review',reason:'Linked refund pair requires paired category resolution'};}
 if(Object.hasOwn(c,'partialHistoricalIncomeDedup'))return (await import('./actual-partial-income-dedup.mjs')).adjustPartialIncomeDedup(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan')});
 if(Object.hasOwn(c,'statementCredit')||Object.hasOwn(c,'statementCreditResolution')){const m=await import('./actual-statement-credit.mjs'),d={connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data,updateWidget:async(rt,w)=>rt.send('dashboard-update-widget',w)};return Object.hasOwn(c,'statementCredit')?m.registerStatementCredit(c,commit,d):m.resolveStatementCredit(c,commit,d);}
 if(Object.hasOwn(c,'splitChildNoteAmendment'))throw new Error('Split child note amendments disabled: direct child updates can corrupt split amounts and balances.');
 if(Object.hasOwn(c,'investmentFxCategory'))return (await import('./actual-investment-fx-categories.mjs')).ensureFxCategory(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,budgets:BUDGETS});
 if(Object.hasOwn(c,'investmentFxConversion'))return (await import('./actual-investment-fx.mjs')).recordInvestmentFx(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,budgets:BUDGETS});
 if(Object.hasOwn(c,'crossCurrencyDebtTransfer'))return (await import('./actual-cross-currency-debt.mjs')).recordCrossCurrencyDebt(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,budgets:BUDGETS});
 if(Object.hasOwn(c,'statementFxExpenseMigration'))return (await import('./actual-statement-fx-expense.mjs')).migrateStatementFxExpense(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,budgets:BUDGETS,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'splitIncidentRecovery'))return (await import('./actual-split-incident-recovery.mjs')).recoverSplitIncident(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'multipleExpenseReimbursement'))return (await import('./actual-multiple-reimbursement.mjs')).reconcileMultipleReimbursement(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'foreignReferenceRemoval'))return (await import('./actual-foreign-reference.mjs')).repairForeignReference(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'splitPurchaseRefund'))return (await import('./actual-split-refund.mjs')).reconstructSplitRefund(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'crossAccountStatementRefund'))return (await import('./actual-cross-account-statement-refund.mjs')).registerCrossAccountStatementRefund(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan')});
 if(Object.hasOwn(c,'linkedRefundCategoryResolution'))return (await import('./actual-linked-refund-category.mjs')).resolveLinkedRefundCategory(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan')});
 if(Object.hasOwn(c,'marketplaceHeldRefund'))return (await import('./actual-marketplace-held-refund.mjs')).reconstructHeldRefund(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data,updateWidget:async(rt,w)=>rt.send('dashboard-update-widget',w)});
 if(Object.hasOwn(c,'marketplaceSaleTransfer'))return (await import('./actual-marketplace-sale-transfer.mjs')).reconcileMarketplaceSaleTransfer(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan')});
 if(Object.hasOwn(c,'statementRefund'))return (await import('./actual-statement-refund.mjs')).registerStatementRefund(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'datedSplitPurchaseRefund'))return (await import('./actual-dated-split-refund.mjs')).registerDatedSplitRefund(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalSplitInstallmentReplacement'))return (await import('./actual-split-installment-replacement.mjs')).replaceSplitInstallments(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,today});
 if(Object.hasOwn(c,'historicalCardTotalReplacement'))return (await import('./actual-historical-total-replacement.mjs')).replaceHistoricalTotal(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,today});
 if(Object.hasOwn(c,'historicalInstallmentDateCorrection'))return (await import('./actual-installment-date.mjs')).amendInstallmentDate(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'recoverInstallmentSeriesAudit'))return (await import('./actual-installment-series-date.mjs')).recoverSeriesAudit(c,commit,{connect,snapshot,requireRun,readState:state,save,readSeriesBackup,writeRecoverySnapshot});
 if(Object.hasOwn(c,'historicalInstallmentSeriesDateCorrection'))return (await import('./actual-installment-series-date.mjs')).amendSeriesDates(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'cardRefinancing'))return (await import('./actual-card-refinancing.mjs')).createRefinancing(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,today,budgets:BUDGETS});
 if(Object.hasOwn(c,'installmentTotalRetirement'))return (await import('./actual-installment-total-dedup.mjs')).retireInstallmentTotal(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'accountRename'))return (await import('./actual-account-rename.mjs')).renameAccount(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,equal,budgets:BUDGETS});
 if(Object.hasOwn(c,'cashflowCategoryResolution'))return (await import('./actual-cashflow-category.mjs')).resolveCashflowCategory(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'cashflowSplitResolution'))return (await import('./actual-cashflow-split.mjs')).resolveCashflowSplit(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'cashflowNotesAmendment'))return (await import('./actual-cashflow-notes.mjs')).amendCashflowNotes(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalExpenseAmountCorrection'))return (await import('./actual-historical-amount.mjs')).correctHistoricalAmount(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalPartialAccountMigration'))return (await import('./actual-partial-account-migration.mjs')).migratePartialAccount(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'crossAccountRefundOverlap'))return (await import('./actual-cross-account-overlap.mjs')).retireCrossAccountOverlap(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'uberSplitDuplicate'))return (await import('./actual-uber-split-duplicate.mjs')).retireUberSplitDuplicate(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'providerRideDedup'))return (await import('./actual-provider-ride-dedup.mjs')).retireProviderRideDuplicate(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'uberCashReconstruction'))return (await import('./actual-uber-cash-reconstruction.mjs')).reconstructUberCash(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'mixedUberCashComponent'))return (await import('./actual-uber-mixed-component.mjs')).recordMixedComponent(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'mixedUberCashNoteAmendment'))return (await import('./actual-uber-mixed-component.mjs')).amendMixedComponentNote(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'mixedUberCashSplit'))return (await import('./actual-uber-mixed-split.mjs')).recordMixedSplit(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'historicalProviderNote'))return (await import('./actual-historical-provider-note.mjs')).amendHistoricalProviderNote(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalSplitDateCorrection'))return (await import('./actual-split-date.mjs')).correctSplitDate(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalSplitAmountCorrection'))return (await import('./actual-split-amount.mjs')).correctSplitAmount(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalSplitAccountCorrection'))return (await import('./actual-split-account.mjs')).correctSplitAccount(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalSimpleAccountCorrection'))return (await import('./actual-split-account.mjs')).correctSimpleAccount(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalSplitDedup'))return (await import('./actual-split-dedup.mjs')).retireSplitDedup(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'confirmedTwinSplitDedup'))return (await import('./actual-twin-split-dedup.mjs')).retireTwinSplitDedup(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalAggregateTransferReplacement'))return (await import('./actual-aggregate-replacement.mjs')).replaceAggregateTransfer(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalTransferDateCorrection'))return (await import('./actual-transfer-date.mjs')).correctTransferDate(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalTransferPostingDates'))return (await import('./actual-transfer-posting-dates.mjs')).correctPostingDates(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'ownedTransferPostingDate'))return (await import('./actual-transfer-posting-dates.mjs')).correctOwnedPostingDate(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'historicalIncomeStatementDate')||Object.hasOwn(c,'historicalExpenseStatementDate'))return (await import('./actual-historical-income-date.mjs')).correctIncomeDate(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,expectedPlan:option('--expected-plan'),readDashboard:async api=>(await api.runQuery(api.q('dashboard').select('*'))).data});
 if(Object.hasOwn(c,'historicalTransferOriginCorrection'))return (await import('./actual-transfer-origin.mjs')).correctTransferOrigin(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'aggregateTransferRetirement'))return (await import('./actual-aggregate-transfer.mjs')).retireAggregateTransfer(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'aggregateDuplicateRetirement'))return (await import('./actual-aggregate-dedup.mjs')).retireAggregateDedup(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalDuplicateExpenseRetirement'))return (await import('./actual-duplicate-expense.mjs')).retireDuplicateExpense(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'unbilledBundledSubscriptionRetirement'))return (await import('./actual-unbilled-subscription.mjs')).retireUnbilledSubscription(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalCreditTransferConversion'))return (await import('./actual-payment-transfer.mjs')).convertHistoricalCreditTransfer(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'paymentTransferConversion'))return (await import('./actual-payment-transfer.mjs')).convertPaymentTransfer(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'verifiedCreditLineAccount'))return (await import('./actual-daily-policy.mjs')).createVerifiedCreditLine(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'statementInvestmentOpening'))return (await import('./actual-investment-opening.mjs')).investmentOpening(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'settlementReceivableOpening'))return (await import('./actual-settlement-receivable.mjs')).settlementReceivable(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'historicalTransferRetirement'))return (await import('./actual-transfer-destination.mjs')).retireHistoricalTransfer(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'transferDestinationAmendment'))return (await import('./actual-transfer-destination.mjs')).correctTransferDestination(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'debtReminderSeries'))return (await import('./actual-debt-reminders.mjs')).createDebtReminders(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,today});
 if(c.cashflow===true||c.postInstallment===true||c.installments||c.remainingInstallment||c.remainingInstallments){const l=commit?await requireRun():await state();if(Object.keys(l.uberCashReconstructions??{}).length&&(await import('./actual-uber-cash-reconstruction.mjs')).uberCashReservedSourceConflict(c,l))return {action:'review',reason:'Source belongs to Uber Cash reconstruction'};}
 if(c.cashflow===true)return (await import('./actual-cashflow.mjs')).cashflow(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,equal,budgets:BUDGETS});
 if(c.seriesRebalance===true)return (await import('./actual-rebalance-series.mjs')).rebalanceSeries(c,commit,{connect,snapshot,backup,requireRun,save,json,equal,budgets:BUDGETS,root});
 if(c.postInstallment===true)return (await import('./actual-post-installment.mjs')).postInstallment(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json,equal,budgets:BUDGETS,root});
 if(Object.hasOwn(c,'transactionResolvedNotesAmendment'))return (await import('./actual-resolved-notes.mjs')).amendResolvedNotes(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'transactionHistoricalCategoryAmendment'))return (await import('./actual-historical-category.mjs')).amendHistoricalCategory(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'transactionHistoricalTagAmendment'))return amendHistoricalTag(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(Object.hasOwn(c,'transactionNotesAmendment')||Object.hasOwn(c,'transactionTagAmendment')||Object.hasOwn(c,'transactionTagsPrefixAmendment')||Object.hasOwn(c,'transactionNotesLineRepair'))return amendTransactionNotes(c,commit,{connect,snapshot,backup,requireRun,readState:state,save,json});
 if(c.scheduleNotesAmendment)return scheduleNotesAmendmentFinancial(c,commit);
 if(c.scheduleAmendment)return scheduleAmendmentFinancial(c,commit);
 if(c.remainingInstallments)return remainingInstallmentsFinancial(c,commit);
 if(c.remainingInstallment)return remainingInstallmentFinancial(c,commit);
 if(c.installments)return installmentFinancial(c,commit);
 {const l=commit?await requireRun():await state();if(Object.keys(l.uberCashReconstructions??{}).length&&(await import('./actual-uber-cash-reconstruction.mjs')).uberCashReservedSourceConflict(c,l))return {action:'review',reason:'Source belongs to Uber Cash reconstruction'};}
 validateCandidate(c);let lease=commit?await requireRun():null;
 let {api}=await connect(BUDGETS[c.currency].syncId), before,dir,action,expectedId,effective=c,ruleId=null,resolutionKind=null,createdNotes,createdSplitNotes;
 try{
  before=await snapshot(api);
  ({candidate:effective,ruleId}=applySimplePayeeCategoryRule(c,before.payees,before.rules));
  validateCandidate(effective);validateLive(effective,before);validateRefund(effective,before.transactions);action=classifyCandidate(effective,before.transactions);
  const ruleResult=ruleId?{ruleApplied:ruleId,category:effective.category}:{};
  if(action.action==='review')return {...action,candidate:effective,...ruleResult};
  if(action.action==='create'){
   createdNotes=candidateTransactionNotes(effective);
   createdSplitNotes=effective.splits?.map(x=>prefixNoteTags(x.notes??''));
  }
  if(!commit)return {...action,candidate:effective,...ruleResult,...(action.action==='create'?{newNotes:createdNotes,...(createdSplitNotes?{splitNotes:createdSplitNotes}:{})}:{})};
  if(action.action==='existing'){
   expectedId=action.id;const old=before.transactions.find(t=>t.id===expectedId);
   if(effective.resolveId){
    const resolution=validateResolution(effective,old);resolutionKind=resolution.kind;dir=await backup(api,effective.currency,before);
    if(resolution.kind==='split')await api.updateTransaction(expectedId,{category:null,is_parent:true,subtransactions:effective.splits.map(x=>({amount:x.amount,category:x.category,notes:x.notes??''}))});
    else await api.updateTransaction(expectedId,{category:effective.category});
    await api.sync();
   }else verifyTransaction(effective,old);
  }else{
   dir=await backup(api,effective.currency,before);
   let payee=before.payees.find(p=>p.name.toLowerCase()===effective.payeeName.toLowerCase()&&!p.transfer_acct)?.id;
   if(!payee)payee=await api.createPayee({name:effective.payeeName});
   const tx={date:effective.date,amount:effective.amount,payee,category:effective.category??null,imported_id:candidateImportedId(effective),cleared:false,notes:createdNotes};
   if(effective.splits){tx.is_parent=true;tx.subtransactions=effective.splits.map((x,i)=>({amount:x.amount,category:x.category,notes:createdSplitNotes[i]}));}
   await api.addTransactions(effective.account,[tx],{runTransfers:false,learnCategories:false});
   expectedId=locateCreatedTransaction(effective,await api.getTransactions(effective.account,effective.date,effective.date));await api.sync();
  }
 }finally{await api.shutdown();}
 ({api}=await connect(BUDGETS[c.currency].syncId));
 try{
  const after=await snapshot(api),actual=after.transactions.find(t=>t.id===expectedId);verifyTransaction(effective,actual);
  if(action.action==='create'){
   assert.equal(actual.notes,createdNotes,'Created notes differ from preview');
   if(effective.splits){
    const notes=xs=>xs.map(x=>JSON.stringify([x.amount,x.category,x.notes??''])).sort();
    assert.deepEqual(notes(actual.subtransactions),notes(effective.splits.map((x,i)=>({...x,notes:createdSplitNotes[i]}))),'Created split notes differ from preview');
   }
  }
  for(const k of ['accounts','categories','rules','schedules'])equal(after[k],before[k],`Unrelated ${k} changed`);
  const afterById=new Map(after.transactions.map(t=>[t.id,t]));
  for(const t of before.transactions)if(t.id!==effective.resolveId)equal(afterById.get(t.id),t,'Unrelated transaction changed '+t.id);
  assert.equal(after.transactions.length,before.transactions.length+(action.action==='create'?1:0),'Unexpected transaction count');
  if(effective.resolveId){
   const old=before.transactions.find(t=>t.id===expectedId);
   if(resolutionKind==='split')for(const k of ['account','date','amount','payee','imported_id','notes','cleared'])assert.equal(actual[k],old[k],`Split resolution changed ${k}`);
   else {const a={...actual,category:null};equal(a,old,'Resolution changed other fields');}
  }
  for(const [id,balance]of Object.entries(before.balances))assert.equal(after.balances[id],balance+(action.action==='create'&&id===effective.account?effective.amount:0),'Unexpected balance change '+id);
  if(dir)await json(dir+'/after.json',after);
  // Financial verification precedes durable ledger; Gmail labels are a separate, retryable step.
  lease=await requireRun();const record={...(effective.refundOf?{refundOf:effective.refundOf}:{}),...(effective.sourceType?{sourceType:effective.sourceType}:{}),transactionId:expectedId,currency:effective.currency,account:effective.account,date:effective.date,amount:effective.amount,payee:effective.payeeName,category:effective.category??null,sourceIds:effective.sourceIds,status:effective.category||effective.splits?'registered':'pending-category',reason:ruleId?null:(effective.categoryReason??null),verifiedAt:new Date().toISOString(),backup:dir??null};
  for(const id of effective.sourceIds)lease.records[id]=record;
  await save(lease);return {...action,id:expectedId,label:effective.sourceType==='manual'?null:record.status==='registered'?'Actual/Registered':'Actual/Review',verified:true,backup:dir,...(ruleId?{ruleApplied:ruleId,category:effective.category}:{})};
 }finally{await api.shutdown();}
}
function installmentRule(schedule,p,installment){
 return {id:schedule.rule,stage:null,conditionsOp:'and',conditions:[
  {op:'is',field:'payee',value:schedule.payee,type:'id'},
  {op:'is',field:'account',value:p.account,type:'id'},
  {op:'isapprox',field:'date',value:installment.date,type:'date'},
  {op:'is',field:'amount',value:installment.amount,type:'number'},
 ],actions:[
  {op:'link-schedule',field:null,value:schedule.id,type:'id'},
  {op:'set',field:'notes',value:installment.notes,type:'string'},
  {op:'set',field:'category',value:p.category,type:'id'},
 ]};
}
async function installmentFinancial(p,commit){
 validateInstallmentPlan(p);let lease=commit?await requireRun():null;
 let {api}=await connect(BUDGETS[p.currency].syncId),before,dir,action,payeeId,scheduleIds=[],ruleIds=[];
 try{
  before=await snapshot(api);validateLive({account:p.account,category:p.category},before);
  action=classifyInstallmentPlan(p,before.schedules);
  if(action.action==='review')return {...action,candidate:p};
  if(action.action==='existing')return {...action,candidate:p};
  if(!commit)return {...action,candidate:p};
  dir=await backup(api,p.currency,before);
  payeeId=before.payees.find(x=>x.name.toLowerCase()===p.payeeName.toLowerCase()&&!x.transfer_acct)?.id;
  if(!payeeId)payeeId=await api.createPayee({name:p.payeeName});
  for(const installment of p.installments){
   const name=installmentScheduleName(p,installment),scheduleId=await api.createSchedule({name,posts_transaction:false,payee:payeeId,account:p.account,amount:installment.amount,amountOp:'is',date:installment.date});
   scheduleIds.push(scheduleId);
   const created=(await api.getSchedules()).find(x=>x.id===scheduleId);assert(created?.rule,`Missing rule for schedule ${scheduleId}`);
   const notes=`${p.notes}; cuota ${installment.number}/${installment.total}; cargo futuro ${installment.date}`;
   await api.updateRule(installmentRule({...created,payee:payeeId},p,{...installment,notes}));
   ruleIds.push(created.rule);
  }
  await api.sync();
 }finally{await api.shutdown();}
 ({api}=await connect(BUDGETS[p.currency].syncId));
 try{
  const after=await snapshot(api),freshSchedules=p.installments.map(i=>{
   const name=installmentScheduleName(p,i),matches=after.schedules.filter(s=>s.name===name);assert.equal(matches.length,1,`Expected one readback schedule ${name}`);return matches[0];
  });
  assert.equal(after.transactions.length,before.transactions.length,'Future schedules must not create posted transactions');
  for(const k of ['accounts','categories'])equal(after[k],before[k],`Unrelated ${k} changed`);
  const beforePayeeIds=new Set(before.payees.map(x=>x.id));for(const payee of after.payees)if(beforePayeeIds.has(payee.id))equal(payee,before.payees.find(x=>x.id===payee.id),`Unrelated payee changed ${payee.id}`);
  assert.equal(after.schedules.length,before.schedules.length+p.installments.length,'Unexpected schedule count');
  assert.equal(after.rules.length,before.rules.length+p.installments.length,'Unexpected rule count');
  for(const [i,schedule]of freshSchedules.entries()){
   const installment=p.installments[i];assert.equal(schedule.account,p.account);assert.equal(schedule.payee,payeeId);assert.equal(schedule.amount,installment.amount);assert.equal(schedule.date,installment.date);assert.equal(schedule.amountOp,'is');assert.equal(schedule.posts_transaction,false);
   assert.equal(scheduleIds[i],schedule.id);assert.equal(ruleIds[i],schedule.rule);
   const rule=after.rules.find(r=>r.id===schedule.rule);assert(rule,'Missing rule readback');
   assert(rule.actions.some(a=>a.op==='link-schedule'&&a.value===schedule.id));
   assert(rule.actions.some(a=>a.op==='set'&&a.field==='category'&&a.value===p.category));
   assert(rule.actions.some(a=>a.op==='set'&&a.field==='notes'&&a.value.includes(`cuota ${installment.number}/${installment.total}`)));
  }
  for(const [id,balance]of Object.entries(before.balances))assert.equal(after.balances[id],balance,'Future schedules must not change balances');
  if(dir)await json(dir+'/after.json',after);
  lease=await requireRun();const record={transactionId:null,scheduleIds,ruleIds,currency:p.currency,account:p.account,date:p.purchaseDate,amount:p.originalTotal,payee:p.payeeName,category:p.category,sourceIds:p.sourceIds,status:'registered',reason:`3 cuotas futuras; redondeo explícito de ${p.roundingAdjustment/100} CLP`,verifiedAt:new Date().toISOString(),backup:dir??null};
  for(const id of p.sourceIds)lease.records[id]=record;
  await save(lease);return {...action,ids:scheduleIds,scheduleIds,ruleIds,label:'Actual/Registered',verified:true,backup:dir,roundingAdjustment:p.roundingAdjustment};
 }finally{await api.shutdown();}
}
async function remainingInstallmentFinancial(p,commit){
 validateRemainingInstallmentPlan(p);let lease=commit?await requireRun():null;
 let {api}=await connect(BUDGETS[p.currency].syncId),before,dir,action,payeeId,scheduleId,ruleId;
 try{
  before=await snapshot(api);validateLive({account:p.account,category:p.category},before);
  action=classifyRemainingInstallmentPlan(p,before.schedules);
  if(action.action==='review')return {...action,candidate:p};
  if(action.action==='existing')return {...action,candidate:p};
  if(!commit)return {...action,candidate:p};
  dir=await backup(api,p.currency,before);
  payeeId=before.payees.find(x=>x.name.toLowerCase()===p.payeeName.toLowerCase()&&!x.transfer_acct)?.id;
  if(!payeeId)payeeId=await api.createPayee({name:p.payeeName});
  const name=installmentScheduleName(p,p.installment);
  scheduleId=await api.createSchedule({name,posts_transaction:false,payee:payeeId,account:p.account,amount:p.installment.amount,amountOp:'is',date:p.installment.date});
  const created=(await api.getSchedules()).find(x=>x.id===scheduleId);assert(created?.rule,`Missing rule for schedule ${scheduleId}`);
  const notes=`${p.notes}; cuota ${p.installment.number}/${p.installment.total}; cargo futuro ${p.installment.date}`;
  await api.updateRule(installmentRule({...created,payee:payeeId},p,{...p.installment,notes}));ruleId=created.rule;
  await api.sync();
 }finally{await api.shutdown();}
 ({api}=await connect(BUDGETS[p.currency].syncId));
 try{
  const after=await snapshot(api),name=installmentScheduleName(p,p.installment),fresh=after.schedules.filter(s=>s.name===name);
  assert.equal(fresh.length,1,`Expected one readback schedule ${name}`);
  const schedule=fresh[0];assert.equal(scheduleId,schedule.id);assert.equal(schedule.account,p.account);assert.equal(schedule.payee,payeeId);assert.equal(schedule.amount,p.installment.amount);assert.equal(schedule.date,p.installment.date);assert.equal(schedule.amountOp,'is');assert.equal(schedule.posts_transaction,false);assert.equal(schedule.rule,ruleId);
  const rule=after.rules.find(r=>r.id===ruleId);assert(rule,'Missing rule readback');assert(rule.actions.some(a=>a.op==='link-schedule'&&a.value===scheduleId));assert(rule.actions.some(a=>a.op==='set'&&a.field==='category'&&a.value===p.category));assert(rule.actions.some(a=>a.op==='set'&&a.field==='notes'&&a.value.includes(`cuota ${p.installment.number}/${p.installment.total}`)));
  assert.equal(after.transactions.length,before.transactions.length,'Future installment must not create a posted transaction');
  for(const k of ['accounts','categories'])equal(after[k],before[k],`Unrelated ${k} changed`);
  const beforePayeeIds=new Set(before.payees.map(x=>x.id));for(const payee of after.payees)if(beforePayeeIds.has(payee.id))equal(payee,before.payees.find(x=>x.id===payee.id),`Unrelated payee changed ${payee.id}`);
  for(const item of before.transactions)equal(after.transactions.find(candidate=>candidate.id===item.id),item,'Transaction changed while creating future installment '+item.id);
  for(const item of before.schedules)equal(after.schedules.find(candidate=>candidate.id===item.id),item,'Unrelated schedule changed '+item.id);
  for(const item of before.rules)if(item.id!==ruleId)equal(after.rules.find(candidate=>candidate.id===item.id),item,'Unrelated rule changed '+item.id);
  assert.equal(after.schedules.length,before.schedules.length+1,'Unexpected schedule count');assert.equal(after.rules.length,before.rules.length+1,'Unexpected rule count');
  for(const [id,balance]of Object.entries(before.balances))assert.equal(after.balances[id],balance,'Future installment changed balance '+id);
  if(dir)await json(dir+'/after.json',after);
  lease=await requireRun();const record={transactionId:null,scheduleIds:[scheduleId],ruleIds:[ruleId],currency:p.currency,account:p.account,date:p.purchaseDate,amount:p.originalTotal,payee:p.payeeName,category:p.category,sourceIds:p.sourceIds,status:'registered',reason:`Cuota ${p.installment.number}/${p.installment.total} pendiente creada como cargo futuro; suma exacta del gasto tarjeta CLP${Math.abs(p.originalTotal)/100}`,installment:p.installment,billedInstallments:p.billedInstallments,verifiedAt:new Date().toISOString(),backup:dir??null};
  for(const id of p.sourceIds)lease.records[id]=record;
  await save(lease);return {...action,ids:[scheduleId],scheduleIds:[scheduleId],ruleIds:[ruleId],label:'Actual/Registered',verified:true,backup:dir};
 }finally{await api.shutdown();}
}
async function remainingInstallmentsFinancial(p,commit){
 validateRemainingInstallmentsPlan(p);let lease=commit?await requireRun():null;
 let {api}=await connect(BUDGETS[p.currency].syncId),before,dir,action,payeeId,scheduleIds=[],ruleIds=[];
 try{
  before=await snapshot(api);validateLive({account:p.account,category:p.category},before);
  action=classifyRemainingInstallmentsPlan(p,before.schedules);
  if(action.action==='review')return {...action,candidate:p};
  if(action.action==='existing')return {...action,candidate:p};
  if(!commit)return {...action,candidate:p};
  dir=await backup(api,p.currency,before);
  payeeId=before.payees.find(x=>x.name.toLowerCase()===p.payeeName.toLowerCase()&&!x.transfer_acct)?.id;
  if(!payeeId)payeeId=await api.createPayee({name:p.payeeName});
  for(const installment of p.futureInstallments){
   const name=installmentScheduleName(p,installment),scheduleId=await api.createSchedule({name,posts_transaction:false,payee:payeeId,account:p.account,amount:installment.amount,amountOp:'is',date:installment.date});
   scheduleIds.push(scheduleId);
   const created=(await api.getSchedules()).find(x=>x.id===scheduleId);assert(created?.rule,`Missing rule for schedule ${scheduleId}`);
   const notes=`${p.notes}; cuota ${installment.number}/${installment.total}; cargo futuro ${installment.date}`;
   await api.updateRule(installmentRule({...created,payee:payeeId},p,{...installment,notes}));ruleIds.push(created.rule);
  }
  await api.sync();
 }finally{await api.shutdown();}
 ({api}=await connect(BUDGETS[p.currency].syncId));
 try{
  const after=await snapshot(api),freshSchedules=p.futureInstallments.map(i=>{
   const name=installmentScheduleName(p,i),matches=after.schedules.filter(s=>s.name===name);assert.equal(matches.length,1,`Expected one readback schedule ${name}`);return matches[0];
  });
  assert.equal(after.transactions.length,before.transactions.length,'Future installments must not create posted transactions');
  for(const k of ['accounts','categories'])equal(after[k],before[k],`Unrelated ${k} changed`);
  const beforePayeeIds=new Set(before.payees.map(x=>x.id));for(const payee of after.payees)if(beforePayeeIds.has(payee.id))equal(payee,before.payees.find(x=>x.id===payee.id),`Unrelated payee changed ${payee.id}`);
  assert.equal(after.schedules.length,before.schedules.length+p.futureInstallments.length,'Unexpected schedule count');
  assert.equal(after.rules.length,before.rules.length+p.futureInstallments.length,'Unexpected rule count');
  for(const [i,schedule]of freshSchedules.entries()){
   const installment=p.futureInstallments[i];assert.equal(schedule.account,p.account);assert.equal(schedule.payee,payeeId);assert.equal(schedule.amount,installment.amount);assert.equal(schedule.date,installment.date);assert.equal(schedule.amountOp,'is');assert.equal(schedule.posts_transaction,false);
   assert.equal(scheduleIds[i],schedule.id);assert.equal(ruleIds[i],schedule.rule);
   const rule=after.rules.find(r=>r.id===schedule.rule);assert(rule,'Missing rule readback');
   assert(rule.actions.some(a=>a.op==='link-schedule'&&a.value===schedule.id));
   assert(rule.actions.some(a=>a.op==='set'&&a.field==='category'&&a.value===p.category));
   assert(rule.actions.some(a=>a.op==='set'&&a.field==='notes'&&a.value.includes(`cuota ${installment.number}/${installment.total}`)));
  }
  for(const [id,balance]of Object.entries(before.balances))assert.equal(after.balances[id],balance,'Future installments changed balance '+id);
  if(dir)await json(dir+'/after.json',after);
  lease=await requireRun();const record={transactionId:null,scheduleIds,ruleIds,currency:p.currency,account:p.account,date:p.purchaseDate,amount:p.originalTotal,payee:p.payeeName,category:p.category,sourceIds:p.sourceIds,status:'registered',reason:`Cuotas futuras ${p.futureInstallments.map(i=>`${String(i.number).padStart(2,'0')}/${String(i.total).padStart(2,'0')}`).join(', ')}; suma exacta del gasto tarjeta CLP${Math.abs(p.originalTotal)/100}`,installments:p.futureInstallments,billedInstallments:p.billedInstallments,verifiedAt:new Date().toISOString(),backup:dir??null};
  for(const id of p.sourceIds)lease.records[id]=record;
  await save(lease);return {...action,ids:scheduleIds,scheduleIds,ruleIds,label:'Actual/Registered',verified:true,backup:dir};
 }finally{await api.shutdown();}
}
async function scheduleAmendmentFinancial(p,commit){
 validateScheduleAmendment(p);let lease=commit?await requireRun():null;
 let {api}=await connect(BUDGETS[p.currency].syncId),before,dir,action;
 try{
  before=await snapshot(api);action=classifyScheduleAmendment(p,before.schedules,before.rules);
  if(action.action==='review')return {...action,candidate:p};
  if(!commit)return {...action,candidate:p};
  dir=await backup(api,p.currency,before);
  const rule=before.rules.find(item=>item.id===p.ruleId);assert(rule,'Target rule missing before amendment');
  await api.updateSchedule(p.scheduleId,{name:p.newScheduleName,amount:p.newAmount},false);
  const updatedRule={...rule,conditions:rule.conditions.map(item=>item.field==='amount'?{...item,value:p.newAmount}:item),actions:rule.actions.map(item=>item.field==='notes'?{...item,value:p.notes}:item)};
  await api.updateRule(updatedRule);await api.sync();
 }finally{await api.shutdown();}
 ({api}=await connect(BUDGETS[p.currency].syncId));
 try{
  const after=await snapshot(api),target=after.schedules.find(item=>item.id===p.scheduleId),rule=after.rules.find(item=>item.id===p.ruleId);
  assert(target,'Target schedule missing after amendment');assert.equal(target.name,p.newScheduleName);assert.equal(target.account,p.account);assert.equal(target.date,p.date);assert.equal(target.amount,p.newAmount);assert.equal(target.posts_transaction,false);assert.equal(target.rule,p.ruleId);
  assert(rule,'Target rule missing after amendment');assert.equal(conditionValue(rule,'amount'),p.newAmount);assert(rule.actions.some(item=>item.op==='link-schedule'&&item.value===p.scheduleId));assert(rule.actions.some(item=>item.op==='set'&&item.field==='category'&&item.value===p.category));assert(rule.actions.some(item=>item.op==='set'&&item.field==='notes'&&item.value===p.notes));
  assert.equal(after.transactions.length,before.transactions.length,'Schedule amendment must not create posted transactions');
  for(const k of ['accounts','categories','payees'])equal(after[k],before[k],`Unrelated ${k} changed`);
  for(const item of before.transactions)equal(after.transactions.find(candidate=>candidate.id===item.id),item,'Transaction changed during schedule amendment '+item.id);
  for(const item of before.schedules)if(item.id!==p.scheduleId)equal(after.schedules.find(candidate=>candidate.id===item.id),item,'Unrelated schedule changed '+item.id);
  for(const item of before.rules)if(item.id!==p.ruleId)equal(after.rules.find(candidate=>candidate.id===item.id),item,'Unrelated rule changed '+item.id);
  assert.equal(after.schedules.length,before.schedules.length,'Unexpected schedule count after amendment');assert.equal(after.rules.length,before.rules.length,'Unexpected rule count after amendment');
  for(const [id,balance]of Object.entries(before.balances))assert.equal(after.balances[id],balance,'Schedule amendment changed balance '+id);
  if(dir)await json(dir+'/after.json',after);
  lease=await requireRun();const existing=lease.records[p.sourceId];assert(existing,'Existing Decathlon ledger record missing');const record={...existing,transactionId:null,scheduleIds:p.series.map(item=>item.scheduleId),ruleIds:p.series.map(item=>item.ruleId),currency:p.currency,account:p.account,date:existing.date,amount:p.originalTotal,payee:p.payeeName,category:p.category,sourceIds:p.sourceIds,status:'registered',reason:p.reason??'3 cuotas futuras; suma exacta del precio real',roundingAdjustment:0,seriesTotal:p.originalTotal,verifiedAt:new Date().toISOString(),backup:dir};
  for(const id of p.sourceIds)lease.records[id]=record;
  await save(lease);return {...action,verified:true,backup:dir,previousAmount:p.oldAmount,newAmount:p.newAmount,total:p.originalTotal};
 }finally{await api.shutdown();}
}
async function scheduleNotesAmendmentFinancial(p,commit){
 validateScheduleNotesAmendment(p);let lease=commit?await requireRun():null;
 let {api}=await connect(BUDGETS[p.currency].syncId),before,dir,action;
 try{
  before=await snapshot(api);action=classifyScheduleNotesAmendment(p,before.schedules,before.rules);
  if(action.action==='review')return {...action,candidate:p};
  if(!commit)return {...action,candidate:p};
  dir=await backup(api,p.currency,before);
  for(const item of p.series){
   const rule=before.rules.find(candidate=>candidate.id===item.ruleId);assert(rule,'Schedule notes target rule missing');
   const note=`${p.notesBase}; cuota ${item.number}/${p.series.length}; cargo futuro ${item.date}`;
   await api.updateRule({...rule,actions:rule.actions.map(action=>action.field==='notes'?{...action,value:note}:action)});
  }
  await api.sync();
 }finally{await api.shutdown();}
 ({api}=await connect(BUDGETS[p.currency].syncId));
 try{
  const after=await snapshot(api),ruleIds=new Set(p.series.map(item=>item.ruleId)),scheduleIds=new Set(p.series.map(item=>item.scheduleId));
  assert.equal(after.transactions.length,before.transactions.length,'Schedule note amendment must not create posted transactions');
  for(const k of ['accounts','categories','payees','schedules'])equal(after[k],before[k],`Unrelated ${k} changed`);
  for(const item of before.transactions)equal(after.transactions.find(candidate=>candidate.id===item.id),item,'Transaction changed during schedule note amendment '+item.id);
  for(const rule of before.rules)if(!ruleIds.has(rule.id))equal(after.rules.find(candidate=>candidate.id===rule.id),rule,'Unrelated rule changed '+rule.id);
  for(const item of p.series){
   const rule=after.rules.find(candidate=>candidate.id===item.ruleId);assert(rule,'Schedule notes target rule missing after amendment');assert.equal(conditionValue(rule,'amount'),item.amount);assert(rule.actions.some(action=>action.op==='link-schedule'&&action.value===item.scheduleId));assert(rule.actions.some(action=>action.op==='set'&&action.field==='category'&&action.value===p.category));assert(rule.actions.some(action=>action.op==='set'&&action.field==='notes'&&action.value===`${p.notesBase}; cuota ${item.number}/${p.series.length}; cargo futuro ${item.date}`));
  }
  assert.equal(after.rules.length,before.rules.length,'Unexpected rule count after schedule note amendment');
  for(const [id,balance]of Object.entries(before.balances))assert.equal(after.balances[id],balance,'Schedule note amendment changed balance '+id);
  if(dir)await json(dir+'/after.json',after);
  lease=await requireRun();const existing=lease.records[p.sourceId];assert(existing,'Existing Decathlon ledger record missing');const record={...existing,transactionId:null,scheduleIds:p.series.map(item=>item.scheduleId),ruleIds:p.series.map(item=>item.ruleId),reason:p.reason??'3 cuotas futuras; suma exacta del precio real',roundingAdjustment:0,seriesTotal:existing.amount,verifiedAt:new Date().toISOString(),backup:dir};
  for(const id of p.sourceIds)lease.records[id]=record;
  await save(lease);return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
function conditionValue(rule,field){return rule.conditions?.find(item=>item.field===field)?.value;}
function validateRemoval(c){
 assert(BUDGETS[c.currency],'Only CLP/USD supported');
 for(const k of ['account','date','payeeName','transactionId','sourceId','evidence','notes'])assert(typeof c[k]==='string'&&c[k].trim(),`Missing ${k}`);
 assert(Number.isSafeInteger(c.amount)&&c.amount<0,'Expense amount must be negative integer cents');
 assert(Array.isArray(c.sourceIds)&&c.sourceIds.length>0&&c.sourceIds.includes(c.sourceId)&&c.sourceIds.every(x=>typeof x==='string'&&x.trim()),'Missing source IDs');
 return c;
}
async function removeFinancial(c,commit){
 {const l=commit?await requireRun():await state();if(Object.keys(l.crossAccountGmailDuplicates??{}).length){const m=await import('./actual-cross-account-gmail-dedup.mjs');if(commit)assert(!m.hasPendingGmailDedup(l),'Pending Gmail duplicate requires investigation');if(m.gmailDedupSourceConflict(c,l))return {action:'review',reason:'Source or transaction belongs to a retired Gmail duplicate'};}}
 if(reservedStatementCreditConflict(c,await state()))return {action:'review',reason:'Source or transaction belongs to statement credit'};
 {const l=commit?await requireRun():await state();if(Object.keys(l.mixedUberCashSplits??{}).length&&(await import('./actual-uber-mixed-split.mjs')).mixedSplitSourceConflict(c,l))return {action:'review',reason:'Source or transaction belongs to mixed Uber Cash split'};}
 {const l=commit?await requireRun():await state();if((await import('./actual-uber-mixed-component.mjs')).mixedComponentSourceConflict(c,l))return {action:'review',reason:'Source or transaction belongs to mixed Uber Cash component'};}
 validateRemoval(c);let lease=commit?await requireRun():await state();
 if(Object.keys(lease.uberCashReconstructions??{}).length&&(await import('./actual-uber-cash-reconstruction.mjs')).uberCashReservedSourceConflict(c,lease))return {action:'review',reason:'Source belongs to Uber Cash reconstruction'};
 if(Object.values(lease.crossAccountStatementRefunds??{}).some(x=>['pending','registered-pending-category'].includes(x?.status))&&(await import('./actual-linked-refund-category.mjs')).pendingRefundPairConflict(c,lease))return {action:'review',reason:'Linked refund pair requires paired category resolution'};
 let {api}=await connect(BUDGETS[c.currency].syncId),before,dir;
 try{
  before=await snapshot(api);
  const tx=before.transactions.find(t=>t.id===c.transactionId);
  assert(tx,'Transaction missing before removal');
  assert(!tx.is_parent&&!tx.is_child&&!tx.transfer_id&&!tx.subtransactions?.length,'Refusing to remove split or transfer');
  assert.equal(tx.account,c.account,'Removal account mismatch');
  assert.equal(tx.date,c.date,'Removal date mismatch');
  assert.equal(tx.amount,c.amount,'Removal amount mismatch');
  const payee=before.payees.find(p=>p.id===tx.payee);
  assert.equal(payee?.name,c.payeeName,'Removal payee mismatch');
  for(const id of c.sourceIds)assert(tx.imported_id===`gmail:${id}`||tx.notes?.includes(`https://mail.google.com/mail/u/0/#all/${id}`),`Removal source mismatch ${id}`);
  if(!commit)return {action:'delete',label:'Actual/Ignore',id:c.transactionId,candidate:c};
  dir=await backup(api,c.currency,before);
  await api.deleteTransaction(c.transactionId);await api.sync();
 }finally{await api.shutdown();}
 ({api}=await connect(BUDGETS[c.currency].syncId));
 try{
  const after=await snapshot(api);
  assert(!after.transactions.some(t=>t.id===c.transactionId),'Transaction still exists after removal');
  assert.equal(after.transactions.length,before.transactions.length-1,'Unexpected transaction count after removal');
  const afterById=new Map(after.transactions.map(t=>[t.id,t]));
  for(const t of before.transactions)if(t.id!==c.transactionId)equal(afterById.get(t.id),t,'Unrelated transaction changed');
  for(const [id,balance]of Object.entries(before.balances))assert.equal(after.balances[id],balance-(id===c.account?c.amount:0),'Unexpected balance change '+id);
  if(dir)await json(dir+'/after.json',after);
  lease=await requireRun();for(const id of c.sourceIds)delete lease.records[id];await save(lease);
  return {action:'delete',label:'Actual/Ignore',id:c.transactionId,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
async function main(){
 if(command==='status'){const s=await state();return {state:s,windows:nextWindows(today(),s)};}
 if(command==='begin-run')return locked(async()=>{const s=await state();assert(!s.activeRun,'An execution is already active; inspect it before recovery');s.activeRun={id:randomUUID(),startedAt:new Date().toISOString(),windows:nextWindows(today(),s)};await save(s);return s.activeRun;});
 if(command==='finish-run')return locked(async()=>{
  const s=await requireRun(),report=await readJSON(option('--file'));assert(Array.isArray(report.reviewed),'Explicit reviewed windows required');
  for(const kind of report.reviewed){assert(['daily','backfill'].includes(kind));const w=s.activeRun.windows[kind];assert(w,'No window for '+kind);assert(report.completeSearch===true,'Search pagination must be complete');s[kind==='daily'?'dailyThrough':'backfillThrough']=w.to;}
  s.runs.push({...s.activeRun,finishedAt:new Date().toISOString(),report});s.activeRun=null;await save(s);return {saved:true};
 });
 if(['plan','apply'].includes(command)){
  const c=await readJSON(option('--file'));if(command==='apply'){assert(args.includes('--commit'),'--commit required');return locked(()=>financial(c,true));}return financial(c,false);
 }
 if(command==='remove'){
  const c=await readJSON(option('--file'));if(args.includes('--commit')){assert(option('--run-id'),'--run-id required');return locked(async()=>{const l=await requireRun(),m=await import('./actual-statement-fx-expense.mjs');assertNoPendingCrossCurrencyDebt(l);assert(!Object.values(l.uberSplitDuplicates??{}).some(x=>x?.status==='pending'),'Pending Uber split retirement requires investigation');assert(!m.hasPendingFxExpenseMigration(l),'Pending FX expense migration requires investigation');assert(!m.migrationSourceConflict(c,l),'Source belongs to completed cross-budget expense migration');if(Object.keys(l.mixedUberCashSplits??{}).length)assert(!(await import('./actual-uber-mixed-split.mjs')).hasPendingMixedSplit(l),'Pending mixed Uber Cash split requires investigation');assert(!(await import('./actual-uber-mixed-component.mjs')).hasPendingMixedComponent(l),'Pending mixed Uber Cash component requires investigation');assert(!Object.values(l.crossAccountRefundOverlaps??{}).some(x=>x?.status==='pending'),'Pending cross-account refund overlap requires investigation');assert(!Object.values(l.providerRideDedups??{}).some(x=>x?.status==='pending'),'Pending provider ride retirement requires investigation');assert(!Object.values(l.uberCashReconstructions??{}).some(x=>x?.status==='pending'),'Pending Uber Cash reconstruction requires investigation');assert(!(await import('./actual-partial-account-migration.mjs')).hasPendingPartialMigration(l),'Pending historical account migration requires investigation');return removeFinancial(c,true)});}if((await import('./actual-statement-fx-expense.mjs')).migrationSourceConflict(c,await state()))return {action:'review',reason:'Source or transaction belongs to completed cross-budget expense migration'};return removeFinancial(c,false);
 }
 if(command==='inventory'){const{api}=await connect();try{return await api.getBudgets();}finally{await api.shutdown();}}
 if(command==='snapshot'){
  const currency=option('--currency');assert(BUDGETS[currency]);const{api}=await connect(BUDGETS[currency].syncId);
  try{const s=await snapshot(api),path=root+'/snapshot-'+currency+'-'+Date.now()+'.json';await json(path,s);return {path,accounts:s.accounts,categories:s.categories,transactions:s.transactions.length};}finally{await api.shutdown();}
 }
 if(command==='adopt-budgets')return locked(async()=>{
  assert(args.includes('--commit'),'--commit required');
  const pendingState=await state();if(Object.keys(pendingState.crossAccountGmailDuplicates??{}).length)assert(!(await import('./actual-cross-account-gmail-dedup.mjs')).hasPendingGmailDedup(pendingState),'Pending Gmail duplicate requires investigation');assert(!Object.values(pendingState.uberSplitDuplicates??{}).some(x=>x?.status==='pending'),'Pending Uber split retirement requires investigation');assert(!Object.values(pendingState.crossAccountRefundOverlaps??{}).some(x=>x?.status==='pending'),'Pending cross-account refund overlap requires investigation');assert(!Object.values(pendingState.providerRideDedups??{}).some(x=>x?.status==='pending'),'Pending provider ride retirement requires investigation');assert(!Object.values(pendingState.uberCashReconstructions??{}).some(x=>x?.status==='pending'),'Pending Uber Cash reconstruction requires investigation');
  assertNoPendingCrossCurrencyDebt(pendingState);
  assert(!(await import('./actual-statement-fx-expense.mjs')).hasPendingFxExpenseMigration(pendingState),'Pending FX expense migration requires investigation');
  if(Object.keys(pendingState.mixedUberCashSplits??{}).length)assert(!(await import('./actual-uber-mixed-split.mjs')).hasPendingMixedSplit(pendingState),'Pending mixed Uber Cash split requires investigation');
  assert(!(await import('./actual-uber-mixed-component.mjs')).hasPendingMixedComponent(pendingState),'Pending mixed Uber Cash component requires investigation');
  assert(!(await import('./actual-partial-account-migration.mjs')).hasPendingPartialMigration(pendingState),'Pending historical account migration requires investigation');
  const{api}=await connect();let budgets;try{budgets=await api.getBudgets();}finally{await api.shutdown();}
  const targets=[...Object.entries(BUDGETS).map(([currency,b])=>({currency,...b})),{currency:'YNAB-CLP',syncId:'84c7b3ba-8389-4b0c-9bad-59041c29c0d2',name:'Archivo YNAB CLP'},{currency:'YNAB-USD',syncId:'51e1e127-74c7-4052-8bba-c691d1cb53f1',name:'Archivo YNAB USD'}];
  const results=[];
  for(const t of targets){
   assert(budgets.some(b=>b.groupId===t.syncId),'Missing expected budget');
   const{api,rt}=await connect(t.syncId);let before,dir;
   try{before=await snapshot(api);dir=await backup(api,t.currency,before);await rt.send('save-prefs',{budgetName:t.name});await api.sync();}finally{await api.shutdown();}
   const fresh=await connect(t.syncId);
   try{equal(await snapshot(fresh.api),before,'Renaming changed financial data');const b=(await fresh.api.getBudgets()).find(b=>b.groupId===t.syncId);assert.equal(b.name,t.name);results.push({name:t.name,syncId:t.syncId,backup:dir,verified:true});}finally{await fresh.api.shutdown();}
  }return results;
 });
 throw new Error('Commands: inventory, adopt-budgets --commit, snapshot --currency CLP|USD, status, begin-run, plan --file JSON, apply --file JSON --run-id ID --commit, remove --file JSON [--run-id ID --commit], finish-run --file JSON --run-id ID');
}
try{
 const result=await main();
 // main() resolves only after all API shutdowns and financial readback checks succeed.
 // On failure, retain every client directory from this command for diagnosis.
 for(const dataDir of temporaryClients){
  try{await rm(dataDir,{recursive:true});}
  catch(e){console.error('Warning: temporary client cleanup failed for '+dataDir+': '+e.message);}
 }
 // A cleanup warning must not turn a verified financial write into a retryable failure.
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
