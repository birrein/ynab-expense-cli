import test from 'node:test';import assert from 'node:assert/strict';
import {classifyRebalance} from './actual-rebalance-series.mjs';
const c={currency:'CLP',account:'a',payee:'p',category:'c',originalTotal:-30000,sourceId:'abc',sourceIds:['abc'],evidence:'statement and user',series:[{number:1,scheduleId:'s1',ruleId:'r1',date:'2026-10-23',oldAmount:-10000,newAmount:-9900,oldName:'one 100',newName:'one 99'},{number:2,scheduleId:'s2',ruleId:'r2',date:'2026-11-23',oldAmount:-10000,newAmount:-10000,oldName:'two',newName:'two'},{number:3,scheduleId:'s3',ruleId:'r3',date:'2026-12-23',oldAmount:-10000,newAmount:-10100,oldName:'three 100',newName:'three 101'}]};
const state=()=>({schedules:c.series.map(x=>({id:x.scheduleId,rule:x.ruleId,account:'a',payee:'p',date:x.date,next_date:x.date,amount:x.oldAmount,name:x.oldName,completed:false,posts_transaction:false})),rules:c.series.map(x=>({id:x.ruleId,conditions:[{field:'amount',value:x.oldAmount}],actions:[{op:'link-schedule',value:x.scheduleId},{op:'set',field:'category',value:'c'}]})),transactions:[]});
test('balanced complete original series previews edit',()=>assert.equal(classifyRebalance(c,state()).action,'edit'));
test('rejects an unbalanced new total',()=>assert.equal(classifyRebalance({...c,originalTotal:-29900},state()).action,'review'));
test('rejects any linked posted installment',()=>{let s=state();s.transactions.push({schedule:'s1'});assert.equal(classifyRebalance(c,s).action,'review')});
test('partial changes require matching recovery backup',()=>{let s=state();s.schedules[0].amount=-9900;s.schedules[0].name='one 99';assert.equal(classifyRebalance(c,s).action,'review');assert.equal(classifyRebalance(c,s,true).action,'recover')});
test('unexpected amount is always rejected',()=>{let s=state();s.rules[0].conditions[0].value=-9800;assert.equal(classifyRebalance(c,s,true).action,'review')});

test('commit changes only target schedule amounts and rules and preserves balances',async()=>{
 const {rebalanceSeries}=await import('./actual-rebalance-series.mjs');const s=state();Object.assign(s,{accounts:[{id:'a'}],categories:[{id:'c'}],payees:[{id:'p'}],balances:{a:50000}});let ledger={records:{abc:{amount:-30000,account:'a',category:'c',sourceIds:['abc'],scheduleIds:['s1','s2','s3'],ruleIds:['r1','r2','r3']}}};
 const api={shutdown:async()=>{},sync:async()=>{},updateSchedule:async(id,fields)=>Object.assign(s.schedules.find(x=>x.id===id),fields),updateRule:async(r)=>{const i=s.rules.findIndex(x=>x.id===r.id);s.rules[i]=r}};
 const ctx={budgets:{CLP:{syncId:'local'}},connect:async()=>({api}),snapshot:async()=>structuredClone(s),backup:async()=>'/backup',requireRun:async()=>ledger,save:async()=>{},json:async()=>{},equal:(a,b)=>assert.deepEqual(a,b)};
 const res=await rebalanceSeries(c,true,ctx);assert.equal(res.verified,true);assert.equal(s.schedules[0].amount,-9900);assert.equal(s.schedules[2].amount,-10100);assert.equal(s.balances.a,50000);assert.equal(ledger.seriesRebalances.abc.backup,'/backup');
});
