import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const script=new URL('./actual-daily.mjs',import.meta.url).pathname;
test('pending owned transfer posting correction blocks financial commands before connection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-owned-posting-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},ownedTransferPostingDateCorrections:{origin:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending owned transfer posting date correction/)}}finally{await rm(root,{recursive:true})}
});
test('pending income date correction blocks every financial mutation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-income-date-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},incomeStatementDateCorrections:{income:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,JSON.stringify({crossAccountGmailDedup:true}));for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending income statement date correction/)}}finally{await rm(root,{recursive:true})}
});
test('pending transfer posting correction blocks all financial mutations before connection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-posting-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},transferPostingDateCorrections:{origin:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,JSON.stringify({crossAccountGmailDedup:true}));for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending transfer posting date correction/)}}finally{await rm(root,{recursive:true})}
});
test('any pending cross-currency debt transfer blocks all financial mutations before connection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-debt-fx-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},crossCurrencyDebtTransfers:{'other-ref':{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending cross-currency debt transfer/)}}finally{await rm(root,{recursive:true})}
});
test('pending FX migration blocks financial commands before connection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-fx-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},statementFxExpenseMigrations:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending FX expense migration/)}}finally{await rm(root,{recursive:true})}
});
test('completed FX migration reserves all aliases and both transaction identities',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-reserved-fx-'));
 try{await writeFile(root+'/state.json',JSON.stringify({statementFxExpenseMigrations:{old:{status:'complete',candidate:{sourceIds:['aaaa1111'],oldTransaction:{id:'old-id'}},newId:'new-id'}}}));const file=root+'/candidate.json';for(const [command,c] of [['plan',{sourceId:'aaaa1111'}],['remove',{transactionId:'old-id'}],['remove',{transactionId:'new-id'}]]){await writeFile(file,JSON.stringify(c));const r=spawnSync(process.execPath,[script,command,'--file',file],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.match(JSON.parse(r.stdout).reason,/cross-budget expense migration/)}}finally{await rm(root,{recursive:true})}
});
test('run lease excludes concurrent runs and incomplete searches cannot advance checkpoints',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-daily-test-'));
 try{
  const initial={version:1,dailyStart:'2026-10-10',dailyThrough:'2026-10-09',backfillThrough:'2026-08-07',activeRun:null,records:{},runs:[]};
  await writeFile(root+'/state.json',JSON.stringify(initial));
  const run=(...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});
  const begin=run('begin-run');assert.equal(begin.status,0,begin.stderr);const lease=JSON.parse(begin.stdout);
  assert.notEqual(run('begin-run').status,0);
  const report=root+'/report.json';await writeFile(report,JSON.stringify({reviewed:['backfill'],completeSearch:false}));
  assert.notEqual(run('finish-run','--run-id',lease.id,'--file',report).status,0);
  assert.equal(JSON.parse(await readFile(root+'/state.json','utf8')).backfillThrough,'2026-08-07');
  assert.notEqual(run('finish-run','--run-id','wrong','--file',report).status,0);
  await writeFile(report,JSON.stringify({reviewed:['backfill'],completeSearch:true,pending:[{reason:'category unknown'}]}));
  const finish=run('finish-run','--run-id',lease.id,'--file',report);assert.equal(finish.status,0,finish.stderr);
  const final=JSON.parse(await readFile(root+'/state.json','utf8'));
  assert.equal(final.backfillThrough,'2026-08-14');assert.equal(final.dailyThrough,'2026-10-09');assert.equal(final.activeRun,null);
  assert.equal(final.runs[0].report.pending.length,1);
 }finally{await rm(root,{recursive:true});}
});
test('a pending account migration blocks removal before candidate validation or connection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-migration-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},historicalAccountMigrations:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending historical account migration/)}}finally{await rm(root,{recursive:true})}
});
test('a pending cross-account overlap retirement blocks all financial mutation commands',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-overlap-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},crossAccountRefundOverlaps:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending cross-account refund overlap/)}}finally{await rm(root,{recursive:true})}
});
test('a pending provider ride retirement blocks all financial mutation commands',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-provider-ride-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},providerRideDedups:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending provider ride retirement/)}}finally{await rm(root,{recursive:true})}
});
test('a pending Uber Cash reconstruction blocks all financial mutation commands',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-uber-cash-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},uberCashReconstructions:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending Uber Cash reconstruction/)}}finally{await rm(root,{recursive:true})}
});
test('a pending mixed Uber Cash component blocks all financial mutation commands',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-mixed-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},mixedUberCashComponents:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending mixed Uber Cash component/)}}finally{await rm(root,{recursive:true})}
});
test('a pending mixed Uber Cash note amendment blocks all financial mutation commands',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-mixed-note-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},mixedUberCashNoteAmendments:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending mixed Uber Cash component/)}}finally{await rm(root,{recursive:true})}
});
test('a pending mixed Uber Cash split blocks all financial mutation commands',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-mixed-split-'));try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},mixedUberCashSplits:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending mixed Uber Cash split/)}}finally{await rm(root,{recursive:true})}
});
test('completed mixed split audits reserve receipt, parent and child identities',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-reserved-mixed-split-'));try{await writeFile(root+'/state.json',JSON.stringify({mixedUberCashSplits:{abc:{status:'complete',id:'wallet-id',childIds:['wallet-child'],candidate:{receipt:'aaaa1111',cardTransaction:{id:'card-id',subtransactions:[{id:'card-child'}]}}}}}));for(const [command,c] of [['plan',{sourceId:'aaaa1111'}],['remove',{transactionId:'wallet-id'}],['remove',{transactionId:'card-child'}]]){const file=root+'/candidate.json';await writeFile(file,JSON.stringify(c));const r=spawnSync(process.execPath,[script,command,'--file',file],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.match(JSON.parse(r.stdout).reason,/mixed Uber Cash split/i);}}finally{await rm(root,{recursive:true})}
});
test('completed mixed Uber Cash audits reserve receipt and transaction identities',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-reserved-mixed-'));try{await writeFile(root+'/state.json',JSON.stringify({mixedUberCashComponents:{abc:{status:'complete',id:'wallet-id',candidate:{receipt:'aaaa1111',cardTransaction:{id:'card-id'}}}}}));for(const [command,c] of [['plan',{sourceId:'aaaa1111'}],['plan',{cashflow:true,sourceIds:['aaaa1111']}],['remove',{transactionId:'wallet-id'}],['remove',{transactionId:'card-id'}]]){const file=root+'/candidate.json';await writeFile(file,JSON.stringify(c));const r=spawnSync(process.execPath,[script,command,'--file',file],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.match(JSON.parse(r.stdout).reason,/mixed Uber Cash/i);}}finally{await rm(root,{recursive:true})}
});
test('completed Uber Cash source groups block ordinary expense and cashflow previews before connecting',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-reserved-uber-cash-'));try{await writeFile(root+'/state.json',JSON.stringify({uberCashReconstructions:{r:{status:'complete',candidate:{funding:{sourceIds:['aaaa1111']},rides:[{sourceId:'bbbb2222'}]}}}}));for(const c of [{sourceId:'aaaa1111',sourceIds:['aaaa1111']},{cashflow:true,sourceId:'bank:other',sourceIds:['bbbb2222']}]){const file=root+'/candidate.json';await writeFile(file,JSON.stringify(c));const r=spawnSync(process.execPath,[script,'plan','--file',file],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).action,'review');assert.match(JSON.parse(r.stdout).reason,/Uber Cash/);}}finally{await rm(root,{recursive:true})}
});
test('completed Uber Cash source groups block independent removal before connecting',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-reserved-uber-remove-'));try{await writeFile(root+'/state.json',JSON.stringify({uberCashReconstructions:{r:{status:'complete',candidate:{funding:{sourceIds:['aaaa1111']},rides:[{sourceId:'bbbb2222'}]}}}}));const c={currency:'CLP',account:'wallet',date:'2024-09-20',payeeName:'Uber',transactionId:'tx',sourceId:'bbbb2222',sourceIds:['bbbb2222'],evidence:'receipt',notes:'receipt',amount:-339000};const file=root+'/candidate.json';await writeFile(file,JSON.stringify(c));const r=spawnSync(process.execPath,[script,'remove','--file',file],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).action,'review');assert.match(JSON.parse(r.stdout).reason,/Uber Cash/);}finally{await rm(root,{recursive:true})}
});
test('pending cross-account Gmail duplicate blocks financial mutations before connection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-pending-gmail-dedup-'));
 try{await writeFile(root+'/state.json',JSON.stringify({activeRun:{id:'lease'},crossAccountGmailDuplicates:{x:{status:'pending'}}}));const file=root+'/candidate.json';await writeFile(file,'{}');for(const args of [['remove','--file',file,'--run-id','lease','--commit'],['apply','--file',file,'--run-id','lease','--commit'],['adopt-budgets','--commit']]){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.notEqual(r.status,0);assert.match(r.stderr,/Pending Gmail duplicate/)}}finally{await rm(root,{recursive:true})}
});
test('retired Gmail sources are reserved in expense and cashflow operations',async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-reserved-gmail-dedup-'));
 try{await writeFile(root+'/state.json',JSON.stringify({crossAccountGmailDuplicates:{x:{status:'complete',candidate:{sourceIds:['aaaa1111'],oldTransaction:{id:'old'},retainedTransaction:{id:'new'}}}}}));const file=root+'/candidate.json';for(const [command,c] of [['plan',{sourceId:'aaaa1111'}],['plan',{cashflow:true,sourceIds:['aaaa1111']}],['remove',{sourceIds:['aaaa1111']}],['remove',{transactionId:'new'}],['plan',{transactionId:'old'}]]){await writeFile(file,JSON.stringify(c));const r=spawnSync(process.execPath,[script,command,'--file',file],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).action,'review');assert.match(JSON.parse(r.stdout).reason,/Gmail duplicate/)}}finally{await rm(root,{recursive:true})}
});

async function compatibilityFixture(t) {
 const parent=await mkdtemp(join(tmpdir(),'actual-daily-contract-'));
 const root=join(parent,'daily');
 t.after(()=>rm(parent,{recursive:true,force:true}));
 const run=(...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{ACTUAL_DAILY_DIR:root}});
 return {parent,root,run};
}

const commandUsage='Commands: inventory, adopt-budgets --commit, snapshot --currency CLP|USD, status, begin-run, plan --file JSON, apply --file JSON --run-id ID --commit, remove --file JSON [--run-id ID --commit], finish-run --file JSON --run-id ID';

test('missing command prints usage and creates only the isolated state root',async t=>{
 const fixture=await compatibilityFixture(t);
 const result=fixture.run();
 assert.equal(result.status,1);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr,commandUsage+'\n');
 assert.deepEqual(await readdir(fixture.root),[]);
});

test('unknown command prints usage and creates only the isolated state root',async t=>{
 const fixture=await compatibilityFixture(t);
 const result=fixture.run('unknown-command');
 assert.equal(result.status,1);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr,commandUsage+'\n');
 assert.deepEqual(await readdir(fixture.root),[]);
});

test('status preserves valid state and emits the expected JSON streams without writing files',async t=>{
 const fixture=await compatibilityFixture(t);
 const state={dailyStart:'2000-01-10',dailyThrough:'2000-01-10',backfillThrough:'2000-01-01',extraState:{preserved:true}};
 const stateBytes=JSON.stringify(state);
 await mkdir(fixture.root,{recursive:true});
 await writeFile(join(fixture.root,'state.json'),stateBytes);
 const result=fixture.run('status');
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stderr,'');
 const normalized=result.stdout.replace(/("to": )"\d{4}-\d{2}-\d{2}"/,'$1"<today-minus-one>"');
 const expected=JSON.stringify({state,windows:{daily:{from:'2000-01-11',to:'<today-minus-one>'},backfill:{from:'2000-01-02',to:'2000-01-08'}}},null,2)+'\n';
 assert.equal(normalized,expected);
 assert.match(result.stdout,/"to": "\d{4}-\d{2}-\d{2}"/);
 assert.equal(await readFile(join(fixture.root,'state.json'),'utf8'),stateBytes);
 assert.deepEqual(await readdir(fixture.root),['state.json']);
});

test('status with missing state reports ENOENT and leaves an empty isolated state root',async t=>{
 const fixture=await compatibilityFixture(t);
 const result=fixture.run('status');
 assert.equal(result.status,1);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr.replaceAll(fixture.root,'<root>'),"ENOENT: no such file or directory, open '<root>/state.json'\n");
 assert.deepEqual(await readdir(fixture.root),[]);
});

test('apply without --commit fails before locking or changing scratch state',async t=>{
 const fixture=await compatibilityFixture(t);
 const stateBytes='{"marker":"unchanged"}';
 await mkdir(fixture.root,{recursive:true});
 await writeFile(join(fixture.root,'state.json'),stateBytes);
 const candidate=join(fixture.parent,'candidate.json');
 await writeFile(candidate,'{}');
 const result=fixture.run('apply','--file',candidate);
 assert.equal(result.status,1);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr,'--commit required\n');
 assert.equal(await readFile(join(fixture.root,'state.json'),'utf8'),stateBytes);
 assert.deepEqual(await readdir(fixture.root),['state.json']);
});
