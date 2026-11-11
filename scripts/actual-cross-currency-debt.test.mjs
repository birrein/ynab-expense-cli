import test from 'node:test';import assert from 'node:assert/strict';
import {classifyCrossCurrencyDebt,recordCrossCurrencyDebt} from './actual-cross-currency-debt.mjs';
const p={crossCurrencyDebtTransfer:true,date:'2025-12-09',reference:'FX-BCH-STATEMENT-2025-12-09',statementFileId:'statement123',evidence:'Both rows in the same statement identify the same card, date and exact debt transfer.',clp:{account:'clp-account',amount:-6839100,category:'out',sourceId:'bank:bch:fx:20251209:clp'},usd:{account:'usd-account',amount:7199,category:'in',sourceId:'bank:bch:fx:20251209:usd'}};
const snap=(currency)=>({accounts:[{id:currency+'-account',closed:false,offbudget:false}],balances:{[currency+'-account']:0},categories:[currency==='clp'?{id:'out',name:'Salida CLP',is_income:false,hidden:false}:{id:'in',name:'Transferencias entre monedas / Entrada USD',is_income:true,hidden:false}],transactions:[],payees:[],rules:[],schedules:[]});
const clone=structuredClone;
test('previews the explicitly evidenced cross-currency rows without conversion',()=>{assert.equal(classifyCrossCurrencyDebt(p,{clp:snap('clp'),usd:snap('usd')},{}).action,'create')});
test('rejects unsupported identities, duplicates and conflicting prior audit',()=>{
 for(const patch of [{date:'2025-02-30'},{statementFileId:''},{reference:'bad'},{evidence:''},{usd:{...p.usd,amount:-7199}},{clp:{...p.clp,sourceId:p.usd.sourceId}}])assert.throws(()=>classifyCrossCurrencyDebt({...p,...patch},{clp:snap('clp'),usd:snap('usd')},{}));
 let s={clp:snap('clp'),usd:snap('usd')};s.usd.transactions.push({id:'x',account:'usd-account',date:'2025-12-10',amount:7199});assert.throws(()=>classifyCrossCurrencyDebt(p,s,{}),/duplicate/i);
 s={clp:snap('clp'),usd:snap('usd')};s.clp.categories[0].name='Groceries';assert.throws(()=>classifyCrossCurrencyDebt(p,s,{}));
 assert.throws(()=>classifyCrossCurrencyDebt(p,{clp:snap('clp'),usd:snap('usd')},{crossCurrencyDebtTransfers:{[p.reference]:{status:'pending'}}}),/pending/i);
});
function fixture(failSecond=false){
 let budgets={clp:snap('clp'),usd:snap('usd')},ledger={},events=[];
 const d={async connect(id){const c=id==='clp-id'?'clp':'usd';return{api:{async shutdown(){},async sync(){},async addTransactions(acc,rows){events.push('write:'+c);if(failSecond&&c==='usd')throw Error('second write failed');const x=rows[0];budgets[c].transactions.push({...x,id:c+'-id',account:acc,transfer_id:null,is_parent:false,is_child:false});budgets[c].balances[acc]+=x.amount}}}},async snapshot(api){return clone(budgets[api._currency])},async backup(api,c){events.push('backup:'+c);return '/backup/'+c},async readState(){return clone(ledger)},async requireRun(){return clone(ledger)},async save(x){ledger=clone(x)},async json(){}};
 const connect=d.connect;d.connect=async id=>{let x=await connect(id);x.api._currency=id==='clp-id'?'clp':'usd';return x};
 d.budgets={CLP:{syncId:'clp-id'},USD:{syncId:'usd-id'}};
 return {d,events,get ledger(){return ledger},get budgets(){return budgets}};
}
test('backs up both budgets and saves pending audit before writing; retry does not rewrite',async()=>{const f=fixture();let x=await recordCrossCurrencyDebt(p,true,f.d);assert.equal(x.verified,true);assert.equal(f.ledger.crossCurrencyDebtTransfers[p.reference].status,'complete');assert.deepEqual(f.events,['backup:CLP','backup:USD','write:clp','write:usd']);assert.equal((await recordCrossCurrencyDebt(p,true,f.d)).verified,true);assert.equal(f.events.filter(x=>x.startsWith('write:')).length,2)});
test('a partial write leaves pending audit and refuses a second write',async()=>{const f=fixture(true);await assert.rejects(recordCrossCurrencyDebt(p,true,f.d),/second write failed/);assert.equal(f.ledger.crossCurrencyDebtTransfers[p.reference].status,'pending');await assert.rejects(recordCrossCurrencyDebt(p,true,f.d),/pending/i);assert.deepEqual(f.events.filter(x=>x.startsWith('write:')),['write:clp','write:usd'])});
test('a second-budget backup failure prevents both writes',async()=>{let f=fixture();let backup=f.d.backup;f.d.backup=async(a,c)=>{if(c==='USD')throw Error('backup failed');return backup(a,c)};await assert.rejects(recordCrossCurrencyDebt(p,true,f.d),/backup failed/);assert.equal(f.events.filter(x=>x.startsWith('write:')).length,0)});
test('unrelated second-budget changes prevent completion and retain pending audit',async()=>{let f=fixture(),save=f.d.save;f.d.save=async l=>{await save(l);if(l.crossCurrencyDebtTransfers?.[p.reference]?.status==='pending')f.budgets.usd.balances['usd-account']=3};await assert.rejects(recordCrossCurrencyDebt(p,true,f.d),/budget changed before write/i);assert.equal(f.ledger.crossCurrencyDebtTransfers[p.reference].status,'pending');assert.deepEqual(f.events.filter(x=>x.startsWith('write:')),['write:clp'])});
test('RappiCard debt conversion requires matching issuer accounts and sources',()=>{
 const q={...clone(p),reference:'FX-RAPPICARD-STATEMENT-2025-12-09',clp:{...p.clp,sourceId:'bank:rappicard:fx:clp'},usd:{...p.usd,sourceId:'bank:rappicard:fx:usd'}};
 const s={clp:snap('clp'),usd:snap('usd')};s.clp.accounts[0].name='Rappi Card';s.usd.accounts[0].name='RappiCard USD';
 assert.equal(classifyCrossCurrencyDebt(q,s,{}).action,'create');
 for(const mutate of [x=>{x.clp.accounts[0].name='BCH Crédito CLP 7481'},x=>{x.usd.accounts[0].name='BCH Crédito USD'}]){let bad=clone(s);mutate(bad);assert.throws(()=>classifyCrossCurrencyDebt(q,bad,{}))}
 for(const bad of [{...q,reference:'FX-OTHER-STATEMENT-2025-12-09'},{...q,clp:{...q.clp,sourceId:'bank:bch:fx:clp'}},{...q,usd:{...q.usd,sourceId:'bank:bch:fx:usd'}}])assert.throws(()=>classifyCrossCurrencyDebt(bad,s,{}));
});
