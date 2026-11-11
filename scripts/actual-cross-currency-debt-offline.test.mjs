import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import * as api from './actual-runtime/node_modules/@actual-app/api/dist/index.js';
import {recordCrossCurrencyDebt} from './actual-cross-currency-debt.mjs';
test('official Actual API preserves the two categorized debt rows and balances in an isolated budget',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'actual-fx-debt-'));let ledger={};
 try{
  const rt=await api.init({dataDir:tmp});await rt.send('create-budget',{budgetName:'Offline FX test',avoidUpload:true});
  const clp=await api.createAccount({name:'Rappi Card',offbudget:false,closed:false}),usd=await api.createAccount({name:'RappiCard USD',offbudget:false,closed:false});
  const group=await api.createCategoryGroup({name:'Transferencias entre monedas',is_income:false});const out=await api.createCategory({name:'Salida CLP',group_id:group,is_income:false});
  const ingroup=await api.createCategoryGroup({name:'Test income',is_income:true});const inc=await api.createCategory({name:'Transferencias entre monedas / Entrada USD',group_id:ingroup,is_income:true});
  const p={crossCurrencyDebtTransfer:true,date:'2025-12-09',reference:'FX-RAPPICARD-STATEMENT-2025-12-09',statementFileId:'statement123',evidence:'Synthetic statement confirms both exact account amounts and dates for isolated API test.',clp:{account:clp,amount:-6839100,category:out,sourceId:'bank:rappicard:fx:clp'},usd:{account:usd,amount:7199,category:inc,sourceId:'bank:rappicard:fx:usd'}};
  const snapshot=async a=>{const account=a._currency==='CLP'?clp:usd,accounts=(await a.getAccounts()).filter(x=>x.id===account),transactions=await a.getTransactions(account,'1900-01-01','2100-01-01');return{accounts,transactions,balances:{[account]:await a.getAccountBalance(account,'2100-01-01')},categories:await a.getCategories(),payees:await a.getPayees(),rules:await a.getRules(),schedules:await a.getSchedules()}};
  const d={budgets:{CLP:{syncId:'clp'},USD:{syncId:'usd'}},connect:async id=>({api:{...api,_currency:id==='clp'?'CLP':'USD',sync:async()=>{},shutdown:async()=>{}}}),snapshot,readState:async()=>structuredClone(ledger),requireRun:async()=>structuredClone(ledger),save:async l=>{ledger=structuredClone(l)},backup:async(a,c)=>{const path=join(tmp,'backup-'+c);await mkdir(path);return path},json:async()=>{}};
  const result=await recordCrossCurrencyDebt(p,true,d);assert(result.verified);assert.equal((await api.getAccountBalance(clp,'2100-01-01')),-6839100);assert.equal((await api.getAccountBalance(usd,'2100-01-01')),7199);assert.equal((await recordCrossCurrencyDebt(p,true,d)).action,'existing');
 }finally{try{await api.shutdown()}catch{}await rm(tmp,{recursive:true,force:true})}
});
