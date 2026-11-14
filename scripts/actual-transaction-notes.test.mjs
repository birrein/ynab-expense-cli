import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyTransactionNotesAmendment, amendTransactionNotes } from './actual-transaction-notes.mjs';

const clone=structuredClone;
function fixture(){
 const sourceIds=['abc123','def456'];
 const oldNotes='Card purchase. Category pending. #Valdivia2026\n'+sourceIds.map(id=>'https://mail.google.com/mail/u/0/#all/'+id).join('\n');
 const p={transactionNotesAmendment:true,currency:'CLP',transactionId:'tx',account:'acct',payeeId:'payee',date:'2026-11-02',amount:-330000,category:'food',sourceId:sourceIds[0],sourceIds,oldNotes,oldText:'Category pending.',newText:'Café americano confirmado por el usuario.',evidence:'Explicit user confirmation'};
 const t={id:'tx',account:p.account,payee:p.payeeId,date:p.date,amount:p.amount,category:p.category,imported_id:'gmail:abc123',notes:oldNotes,cleared:false,is_parent:false,is_child:false,transfer_id:null};
 const before={accounts:[{id:'acct',closed:false,offbudget:false}],categories:[{id:'food',hidden:false}],payees:[{id:'payee',name:'Cafe'}],rules:[],schedules:[],balances:{acct:-330000},transactions:[t,{...t,id:'unrelated',imported_id:'gmail:fed789',notes:'Other note'}]};
 const record={transactionId:'tx',currency:p.currency,account:p.account,date:p.date,amount:p.amount,category:p.category,sourceIds,status:'registered',reason:null,backup:'original-backup',verifiedAt:'original-date'};
 const state={activeRun:{id:'run'},dailyThrough:'2026-11-03',backfillThrough:'2026-10-09',records:{abc123:clone(record),def456:clone(record),other:{untouched:true}},runs:[]};
 return {p,before,state};
}
test('preview is bounded, preserves sources and tags, and recognizes exact desired state',()=>{
 const {p,before,state}=fixture();const a=classifyTransactionNotesAmendment(p,before,state);
 assert.equal(a.action,'amend-notes');assert.equal(a.newNotes,p.oldNotes.replace(p.oldText,p.newText));
 before.transactions[0].notes=a.newNotes;
 assert.equal(classifyTransactionNotesAmendment(p,before,state).action,'existing');
});
for(const field of ['transactionId','account','date','amount','category','payeeId','sourceId','oldNotes']){
 test('rejects stale '+field,()=>{
  const {p,before,state}=fixture();p[field]=field==='amount'?-430000:field==='date'?'2026-11-01':'changed';
  assert.throws(()=>classifyTransactionNotesAmendment(p,before,state));
 });
}
for(const [name,change] of [
 ['missing evidence',p=>delete p.evidence],['archived budget',p=>p.currency='ARCHIVE'],
 ['duplicate sources',p=>p.sourceIds.push(p.sourceId)],['missing secondary source',p=>p.sourceIds.pop()],
 ['link replacement',p=>p.oldText='https://mail.google.com/mail/u/0/#all/abc123'],
 ['tag replacement',p=>p.oldText='#Valdivia2026'],['metadata injection',p=>p.newText='source=manual:test'],
 ['URL substring',p=>p.oldText='abc123'],['tag substring',p=>p.oldText='Valdivia2026'],
 ['multiline replacement',p=>p.newText='coffee\nother'],['ambiguous fragment',p=>p.oldText='a'],
 ['conflicting resolution',p=>p.resolveId='tx'],['noop',p=>p.newText=p.oldText],
 ])test('rejects '+name,()=>{const {p,before,state}=fixture();change(p);assert.throws(()=>classifyTransactionNotesAmendment(p,before,state));});
for(const [name,change] of [
 ['split',b=>b.transactions[0].is_parent=true],['child',b=>b.transactions[0].is_child=true],
 ['transfer',b=>b.transactions[0].transfer_id='transfer'],['subtransactions',b=>b.transactions[0].subtransactions=[{}]],
 ['closed account',b=>b.accounts[0].closed=true],['hidden category',b=>b.categories[0].hidden=true],
 ['duplicate transaction',b=>b.transactions.push({...b.transactions[0],id:'dup'})],
 ['wrong imported id',b=>b.transactions[0].imported_id='gmail:other'],
 ])test('rejects live '+name,()=>{const {p,before,state}=fixture();change(before);assert.throws(()=>classifyTransactionNotesAmendment(p,before,state));});
for(const field of ['transactionId','currency','account','date','amount','category','status','sourceIds']){
 test('rejects discordant ledger '+field,()=>{const {p,before,state}=fixture();state.records.def456[field]=field==='sourceIds'?['abc123']:field==='amount'?-1:'wrong';assert.throws(()=>classifyTransactionNotesAmendment(p,before,state));});
}
function tagFixture(){
 const f=fixture(),p=f.p;
 delete p.transactionNotesAmendment;delete p.oldText;delete p.newText;
 p.transactionTagAmendment=true;p.tag='#Valdivia2026';
 p.oldNotes=p.oldNotes.replace(' #Valdivia2026','');f.before.transactions[0].notes=p.oldNotes;
 return f;
}
function prefixFixture(){
 const f=fixture(),p=f.p;
 delete p.transactionNotesAmendment;delete p.oldText;delete p.newText;
 p.transactionTagsPrefixAmendment=true;
 return f;
}
function runtime(failure='',already=false,kind='notes'){
 const {p,before,state}=(kind==='tag'?tagFixture:kind==='prefix'?prefixFixture:fixture)(),events=[];let live=clone(before),saved=null,connections=0;
 if(already)live.transactions[0].notes=classifyTransactionNotesAmendment(p,before,state).newNotes;
 const api={
  async updateTransaction(id,patch){events.push('update');assert.equal(id,'tx');assert.deepEqual(Object.keys(patch),['notes']);live.transactions[0].notes=patch.notes;},
  async sync(){events.push('sync');if(failure==='sync'&&events.includes('update'))throw Error('sync failed');},
  async shutdown(){events.push('shutdown');},
 };
 const deps={
  async connect(){connections++;events.push('connect');if(failure==='download'&&connections===2)throw Error('download failed');return {api};},
  async snapshot(){
   events.push('snapshot');const s=clone(live);
   if(failure==='prewrite-drift'&&events.includes('backup')&&!events.includes('update'))s.transactions[0].notes+=' changed';
   if(connections===2){
    if(failure==='readback-notes')s.transactions[0].notes='stale';
    if(failure==='readback-category')s.transactions[0].category='other';
    if(failure==='readback-unrelated')s.transactions[1].notes='other edit';
    if(failure==='readback-balance')s.balances.acct++;
    if(failure==='readback-count')s.transactions.push({...s.transactions[1],id:'new'});
   }return s;
  },
  async backup(){events.push('backup');if(failure==='backup')throw Error('backup failed');return '/private/backup';},
  async json(path){events.push(path.endsWith('after.json')?'after':'audit');},
  async readState(){return clone(state);},
  async requireRun(){events.push('lease');if(failure==='lease'||(failure==='lost-lease'&&events.includes('backup')))throw Error('lease missing');return clone(state);},
  async save(s){events.push('save');saved=clone(s);},
 };
 return {p,before,state,events,deps,get saved(){return saved;},get live(){return live;}};
}
test('plan performs no backup, mutation, sync or state write',async()=>{
 const r=runtime();const a=await amendTransactionNotes(r.p,false,r.deps);
 assert.equal(a.action,'amend-notes');assert.deepEqual(r.events,['connect','snapshot','shutdown']);assert.equal(r.saved,null);
});
test('commit backs up before notes-only patch, rechecks lease, downloads independently and preserves ledger',async()=>{
 const r=runtime();const result=await amendTransactionNotes(r.p,true,r.deps);
 assert.equal(result.verified,true);assert.equal(result.id,'tx');assert.equal(result.label,null);
 assert(r.events.indexOf('backup')<r.events.indexOf('update'));
 assert.equal(r.events.filter(x=>x==='connect').length,2);
 const saved=clone(r.saved);for(const id of r.p.sourceIds){assert.equal(saved.records[id].notesAmendments.length,1);delete saved.records[id].notesAmendments;}
 assert.deepEqual(saved,r.state);assert.equal(r.live.transactions[0].notes,r.p.oldNotes.replace(r.p.oldText,r.p.newText));
});
for(const failure of ['lease','backup','lost-lease','prewrite-drift','sync','download','readback-notes','readback-category','readback-unrelated','readback-balance','readback-count']){
 test('failure '+failure+' never records success',async()=>{
  const r=runtime(failure);await assert.rejects(amendTransactionNotes(r.p,true,r.deps));assert.equal(r.saved,null);
  if(['lease','backup','lost-lease','prewrite-drift'].includes(failure))assert(!r.events.includes('update'));
 });
}
test('retry independently verifies exact desired state without another write and recovers audit',async()=>{
 const r=runtime('',true),a=await amendTransactionNotes(r.p,true,r.deps);
 assert.equal(a.action,'existing');assert.equal(a.verified,true);assert(!r.events.includes('backup'));assert(!r.events.includes('update'));assert.equal(r.events.filter(x=>x==='connect').length,2);
 assert.equal(r.saved.records.abc123.notesAmendments[0].recovered,true);
 r.state.records=clone(r.saved.records);
 await amendTransactionNotes(r.p,true,r.deps);assert.equal(r.saved.records.abc123.notesAmendments.length,1);
});
test('manual provenance is preserved without Gmail links',()=>{
 const {p,before,state}=fixture();p.sourceType='manual';p.sourceId='manual:coffee';p.sourceIds=[p.sourceId];
 p.oldNotes='Category pending. #Valdivia2026\nsource=manual:coffee';
 before.transactions[0].notes=p.oldNotes;before.transactions[0].imported_id=p.sourceId;
 const r={...state.records.abc123,sourceType:'manual',sourceIds:p.sourceIds};state.records={[p.sourceId]:r};
 assert.match(classifyTransactionNotesAmendment(p,before,state).newNotes,/source=manual:coffee$/);
 p.oldText='coffee';assert.throws(()=>classifyTransactionNotesAmendment(p,before,state),/protected metadata/);
});
for(const kind of ['notes','tag','prefix'])test(`CLI ${kind} rejects missing/foreign lease, missing commit, and existing lock without API or state writes`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'actual-notes-cli-'));
 try{
  const {p,state}=(kind==='tag'?tagFixture:kind==='prefix'?prefixFixture:fixture)();const file=join(root,'candidate.json'),statePath=join(root,'state.json');
  await writeFile(file,JSON.stringify(p));await writeFile(statePath,JSON.stringify(state));
  const original=await readFile(statePath,'utf8');
  const cli=new URL('./actual-runtime/actual-daily.ts',import.meta.url).pathname;
  const run=(...args)=>spawnSync(process.execPath,[cli,'apply','--file',file,...args],{encoding:'utf8',env:{...process.env,ACTUAL_DAILY_DIR:root}});
  for(const args of [[],['--commit'],['--commit','--run-id','foreign']]){
   const r=run(...args);assert.equal(r.status,1);assert.match(r.stderr,/commit required|Run lease missing/);
   assert.equal(await readFile(statePath,'utf8'),original);
  }
  await mkdir(join(root,'write.lock'));await writeFile(join(root,'write.lock','owner'),'other-run');
  const locked=run('--commit','--run-id','run');assert.equal(locked.status,1);assert.match(locked.stderr,/EEXIST/);
  assert.equal(await readFile(join(root,'write.lock','owner'),'utf8'),'other-run');assert.equal(await readFile(statePath,'utf8'),original);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('tag preview prepends only a standalone tag and preserves every original byte',async()=>{
 const r=runtime('','', 'tag');const a=await amendTransactionNotes(r.p,false,r.deps);
 assert.equal(a.action,'add-tag');assert.equal(a.newNotes,'#Valdivia2026\n'+r.p.oldNotes);assert.equal(a.tag,'#Valdivia2026');
 assert.deepEqual(r.events,['connect','snapshot','shutdown']);assert.equal(r.saved,null);
});
test('tag prefix preserves an existing terminal newline',()=>{
 const {p,before,state}=tagFixture();p.oldNotes+='\n';before.transactions[0].notes=p.oldNotes;
 assert.equal(classifyTransactionNotesAmendment(p,before,state).newNotes,p.tag+'\n'+p.oldNotes);
});
for(const existing of ['#Valdivia2026','#valdivia2026','(#Valdivia2026).','Viaje: #VALDIVIA2026; listo']){
 test('one existing tag is preserved: '+existing,async()=>{
  const r=runtime('','','tag');r.p.oldNotes+='\n'+existing;r.live.transactions[0].notes=r.p.oldNotes;
  const a=await amendTransactionNotes(r.p,true,r.deps);
  assert.equal(a.action,'existing');assert.equal(a.newNotes,r.p.oldNotes);assert.equal(a.verified,true);
  assert(!r.events.includes('update'));assert(!r.events.includes('backup'));assert(!r.events.includes('save'));
 });
}
for(const text of ['#Valdivia2026_extra','#Valdivia2026-extra','#Valdivia20260','#Valdivia','#Valdivia2026ñ','https://example.test/#Valdivia2026','https://example.test/#Valdivia2026-extra']){
 test('tag is distinct from '+text,()=>{
  const {p,before,state}=tagFixture();p.oldNotes+='\n'+text;before.transactions[0].notes=p.oldNotes;
  assert.equal(classifyTransactionNotesAmendment(p,before,state).newNotes,p.tag+'\n'+p.oldNotes);
 });
}
for(const tag of ['',null,'Valdivia2026','#','##Valdivia2026','#Valdivia2026 #other','#Valdivia2026\nsource=evil','#Valdivia2026\r','#Valdivia.2026','#2026','#'+'a'.repeat(65),'#café']){
 test('rejects unsafe tag '+JSON.stringify(tag),()=>{const {p,before,state}=tagFixture();p.tag=tag;assert.throws(()=>classifyTransactionNotesAmendment(p,before,state));});
}
for(const [name,change]of [
 ['replacement field',p=>p.newText='arbitrary'],['old text field',p=>p.oldText='Category pending.'],
 ['both flags',p=>p.transactionNotesAmendment=true],['false second flag',p=>p.transactionNotesAmendment=false],
 ['false flag',p=>p.transactionTagAmendment=false],['stale notes',p=>p.oldNotes+='changed'],
 ['wrong category',p=>p.category='other'],['missing source',p=>p.sourceIds.pop()],
 ['missing evidence',p=>delete p.evidence],['archive budget',p=>p.currency='ARCHIVE'],
 ])test('tag rejects '+name,()=>{const {p,before,state}=tagFixture();change(p);assert.throws(()=>classifyTransactionNotesAmendment(p,before,state));});
test('duplicate tag occurrences stop without insertion or removal',async()=>{
 const r=runtime('','','tag');r.p.oldNotes+='\n#Valdivia2026 #valdivia2026';r.live.transactions[0].notes=r.p.oldNotes;
 await assert.rejects(amendTransactionNotes(r.p,true,r.deps));assert(!r.events.includes('update'));assert(!r.events.includes('backup'));assert.equal(r.saved,null);
});
test('tag commit verifies independently, retains histories and records explicit operation',async()=>{
 const r=runtime('','','tag'),existing={oldNotes:'old',newNotes:'new',backup:'prior'};
 for(const id of r.p.sourceIds)r.state.records[id].notesAmendments=[clone(existing)];
 const a=await amendTransactionNotes(r.p,true,r.deps);assert.equal(a.action,'add-tag');assert.equal(a.verified,true);assert.equal(a.label,null);
 assert(r.events.indexOf('backup')<r.events.indexOf('update'));assert.equal(r.events.filter(x=>x==='connect').length,2);
 const saved=clone(r.saved);for(const id of r.p.sourceIds){
  const history=saved.records[id].notesAmendments;assert.equal(history.length,2);assert.deepEqual(history[0],existing);
  assert.equal(history[1].operation,'add-tag');assert.equal(history[1].tag,r.p.tag);assert.equal(history[1].newNotes,r.p.tag+'\n'+r.p.oldNotes);
  history.pop();
 }assert.deepEqual(saved,r.state);
});
for(const failure of ['lease','backup','lost-lease','prewrite-drift','sync','download','readback-notes','readback-category','readback-unrelated','readback-balance','readback-count']){
 test('tag failure '+failure+' has no success audit',async()=>{
  const r=runtime(failure,false,'tag');await assert.rejects(amendTransactionNotes(r.p,true,r.deps));assert.equal(r.saved,null);
  if(['lease','backup','lost-lease','prewrite-drift'].includes(failure))assert(!r.events.includes('update'));
 });
}
test('tag retry recovers missing audit without repeating mutation',async()=>{
 const r=runtime('',true,'tag'),a=await amendTransactionNotes(r.p,true,r.deps);
 assert.equal(a.action,'existing');assert.equal(a.verified,true);assert(!r.events.includes('backup'));assert(!r.events.includes('update'));
 assert.equal(r.saved.records.abc123.notesAmendments[0].recovered,true);assert.equal(r.saved.records.abc123.notesAmendments[0].operation,'add-tag');
 r.state.records=clone(r.saved.records);await amendTransactionNotes(r.p,true,r.deps);assert.equal(r.saved.records.abc123.notesAmendments.length,1);
});

test('prefix preview moves existing tokens only and writes nothing',async()=>{
 const r=runtime('',false,'prefix'),a=await amendTransactionNotes(r.p,false,r.deps);
 assert.equal(a.action,'prefix-tags');
 assert.equal(a.newNotes,'#Valdivia2026\n'+r.p.oldNotes.replace(' #Valdivia2026',''));
 assert.deepEqual(r.events,['connect','snapshot','shutdown']);assert.equal(r.saved,null);
});
test('prefix commit uses shared safeguards and preserves prior audit and ledger',async()=>{
 const r=runtime('',false,'prefix'),prior={oldNotes:'old',newNotes:'new',backup:'prior'};
 for(const id of r.p.sourceIds)r.state.records[id].notesAmendments=[clone(prior)];
 const a=await amendTransactionNotes(r.p,true,r.deps);
 assert.equal(a.action,'prefix-tags');assert.equal(a.verified,true);assert.equal(a.label,null);
 assert(r.events.indexOf('backup')<r.events.indexOf('update'));assert.equal(r.events.filter(x=>x==='connect').length,2);
 const saved=clone(r.saved);
 for(const id of r.p.sourceIds){
  const history=saved.records[id].notesAmendments;assert.equal(history.length,2);assert.deepEqual(history[0],prior);
  assert.equal(history[1].operation,'prefix-tags');assert.equal(history[1].newNotes,a.newNotes);history.pop();
 }
 assert.deepEqual(saved,r.state);
});
for(const failure of ['lease','backup','lost-lease','prewrite-drift','sync','download','readback-notes','readback-category','readback-unrelated','readback-balance','readback-count'])test('prefix failure '+failure+' has no success audit',async()=>{
 const r=runtime(failure,false,'prefix');await assert.rejects(amendTransactionNotes(r.p,true,r.deps));assert.equal(r.saved,null);
 if(['lease','backup','lost-lease','prewrite-drift'].includes(failure))assert(!r.events.includes('update'));
});
test('prefix retry recovers audit without repeating a successful write',async()=>{
 const r=runtime('',true,'prefix'),a=await amendTransactionNotes(r.p,true,r.deps);
 assert.equal(a.action,'existing');assert.equal(a.verified,true);assert(!r.events.includes('update'));assert(!r.events.includes('backup'));
 assert.equal(r.saved.records.abc123.notesAmendments[0].operation,'prefix-tags');assert.equal(r.saved.records.abc123.notesAmendments[0].recovered,true);
 r.state.records=clone(r.saved.records);await amendTransactionNotes(r.p,true,r.deps);assert.equal(r.saved.records.abc123.notesAmendments.length,1);
});
for(const canonical of [true,false])test('prefix no-op without tags or already canonical has no audit: '+canonical,async()=>{
 const r=runtime('',false,'prefix');
 r.p.oldNotes=(canonical?'#Valdivia2026\n':'')+r.p.oldNotes.replace(' #Valdivia2026','');r.live.transactions[0].notes=r.p.oldNotes;
 const a=await amendTransactionNotes(r.p,true,r.deps);
 assert.equal(a.action,'existing');assert.equal(a.newNotes,r.p.oldNotes);assert.equal(a.verified,true);
 assert(!r.events.includes('update'));assert(!r.events.includes('backup'));assert.equal(r.saved,null);
});
for(const [name,change]of [
 ['tag field',p=>p.tag='#Trip'],['oldText',p=>p.oldText='Card'],['newText',p=>p.newText='Coffee'],
 ['tag flag',p=>p.transactionTagAmendment=true],['false tag flag',p=>p.transactionTagAmendment=false],
 ['notes flag',p=>p.transactionNotesAmendment=true],['false prefix flag',p=>p.transactionTagsPrefixAmendment=false],
 ['duplicate',p=>p.oldNotes+='\n#valdivia2026'],['source IDs',p=>p.sourceIds.pop()],['archived budget',p=>p.currency='ARCHIVE'],
 ['glued tags',p=>p.oldNotes+='\n#Trip#trip'],
])test('prefix rejects '+name,async()=>{
 const r=runtime('',false,'prefix');change(r.p);r.live.transactions[0].notes=r.p.oldNotes;
 await assert.rejects(amendTransactionNotes(r.p,true,r.deps));assert(!r.events.includes('update'));assert(!r.events.includes('backup'));assert.equal(r.saved,null);
});
test('concatenated Gmail source and tag require review without inventing provenance',async()=>{
 const r=runtime('',false,'prefix');
 r.p.oldNotes='Confirmed purchase.https://mail.google.com/mail/u/0/#all/abc123#Valdivia2026\nhttps://mail.google.com/mail/u/0/#all/def456';
 r.live.transactions[0].notes=r.p.oldNotes;
 await assert.rejects(amendTransactionNotes(r.p,true,r.deps),/source IDs differ/);
 assert(!r.events.includes('update'));assert(!r.events.includes('backup'));assert.equal(r.saved,null);
});
test('manual prefix retains exact manual provenance',()=>{
 const {p,before,state}=prefixFixture();p.sourceType='manual';p.sourceId='manual:coffee';p.sourceIds=[p.sourceId];
 p.oldNotes='Coffee #Trip\nsource=manual:coffee';before.transactions[0].notes=p.oldNotes;before.transactions[0].imported_id=p.sourceId;
 state.records={[p.sourceId]:{...state.records.abc123,sourceType:'manual',sourceIds:p.sourceIds}};
 assert.equal(classifyTransactionNotesAmendment(p,before,state).newNotes,'#Trip\nCoffee\nsource=manual:coffee');
});

function repairFixture(){
 const f=prefixFixture(),p=f.p;
 delete p.transactionTagsPrefixAmendment;p.transactionNotesLineRepair=true;
 p.sourceIds=['abc123'];f.state.records.abc123.sourceIds=p.sourceIds;delete f.state.records.def456;
 p.priorNotes=p.oldNotes.replace(' #Valdivia2026','').replace('\nhttps://mail.google.com/mail/u/0/#all/def456','')+'\n#Valdivia2026';
 p.oldNotes=p.priorNotes.replaceAll('\n','');f.before.transactions[0].notes=p.oldNotes;
 for(const id of p.sourceIds)f.state.records[id].notesAmendments=[{operation:'add-tag',tag:'#Valdivia2026',newNotes:p.priorNotes,verifiedAt:'prior',backup:'verified-backup'}];
 return f;
}
test('audited joined lines preview restores original sources and prefixes tag',()=>{
 const {p,before,state}=repairFixture(),a=classifyTransactionNotesAmendment(p,before,state);
 assert.equal(a.action,'repair-note-lines');assert.equal(a.newNotes,'#Valdivia2026\n'+p.priorNotes.slice(0,-'#Valdivia2026'.length));
 before.transactions[0].notes=a.newNotes;assert.equal(classifyTransactionNotesAmendment(p,before,state).action,'existing');
});
for(const [name,change] of [
 ['no audit',f=>delete f.state.records.abc123.notesAmendments],
 ['audit lacks verified backup',f=>delete f.state.records.abc123.notesAmendments[0].backup],
 ['audit does not match',f=>f.state.records.abc123.notesAmendments[0].newNotes+='x'],
 ['not an add-tag audit',f=>f.state.records.abc123.notesAmendments[0].operation='other'],
 ['content alteration',f=>f.p.oldNotes+='x'],['prior source alteration',f=>f.p.priorNotes=f.p.priorNotes.replace('abc123','abc124')],
 ['arbitrary new text',f=>f.p.newText='other'],['mixed flags',f=>f.p.transactionTagAmendment=true],
 ['live drift',f=>f.before.transactions[0].notes+='x'],
 ])test('joined line repair rejects '+name,()=>{const f=repairFixture();change(f);assert.throws(()=>classifyTransactionNotesAmendment(f.p,f.before,f.state));});
test('joined line repair uses backup and verifies full snapshot before audit',async()=>{
 const r=runtime('',false,'prefix'),f=repairFixture();Object.assign(r.p,f.p);delete r.p.transactionTagsPrefixAmendment;
 Object.assign(r.state,f.state);r.live.transactions[0].notes=f.p.oldNotes;
 const a=await amendTransactionNotes(r.p,true,r.deps);assert.equal(a.verified,true);assert.equal(a.action,'repair-note-lines');
 assert(r.events.indexOf('backup')<r.events.indexOf('update'));assert.equal(r.events.filter(x=>x==='connect').length,2);
 assert.equal(r.saved.records.abc123.notesAmendments.at(-1).operation,'repair-note-lines');
});
