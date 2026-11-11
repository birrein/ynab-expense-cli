import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHeldRefund,reconstructHeldRefund} from './actual-marketplace-held-refund.mjs';

const fee=(id,date,amount,source)=>({id,account:'wallet',date,amount,payee:'merchant',category:null,imported_id:source,notes:`source=${source}`,is_parent:false,is_child:false,parent_id:null,subtransactions:[],transfer_id:null,reconciled:false,schedule:null,tombstone:false});
const fees=[fee('fee1','2024-11-05',-420000,'bank:shipping'),fee('fee2','2024-11-09',-700000,'bank:mediation')];
const record=t=>({id:t.id,type:'expense',currency:'CLP',account:t.account,date:t.date,amount:t.amount,category:null,status:'review',verifiedAt:'2026-11-01T00:00:00Z',backup:'/backup',driveFileIds:['report12345']});
const ledger={cashflows:Object.fromEntries(fees.map(x=>[x.imported_id,record(x)]))};
const snapshot={accounts:[{id:'wallet',name:'Wallet',offbudget:false,closed:false}],categories:[{id:'income',name:'Income',group_id:'income-group',is_income:true,hidden:false}],payees:[{id:'merchant',name:'Marketplace',transfer_acct:null},{id:'toWallet',name:'Wallet',transfer_acct:'wallet'}],transactions:[...fees,{id:'out',account:'wallet',date:'2024-11-05',amount:-3830100,is_child:false,tombstone:false},{id:'deposit',account:'wallet',date:'2024-11-09',amount:5000000,is_child:false,tombstone:false},{id:'profit',account:'wallet',date:'2024-11-05',amount:100,is_child:false,tombstone:false}],balances:{wallet:50000},rules:[],schedules:[]};
const candidate={marketplaceHeldRefund:true,currency:'CLP',wallet:'wallet',holdingName:'Marketplace fondos retenidos - historico',incomeCategoryName:'Ajustes de ventas canceladas',incomeGroup:'income-group',payee:'merchant',reference:'claim12345',reportId:'report12345',claimFileId:'claim123456',statementIds:['statement01','statement02','statement03'],fees:fees.map(t=>({transaction:t,record:record(t)})),sale:{date:'2024-11-05',amount:4250000,sourceId:'bank:sale'},hold:{date:'2024-11-09',releaseDate:'2024-11-11',amount:3830000,sourceId:'bank:hold',releaseSourceId:'bank:release'},settlements:[{date:'2024-11-11',amount:-470000,sourceId:'bank:settle1'},{date:'2024-11-11',amount:750000,sourceId:'bank:settle2'},{date:'2024-11-11',amount:-750000,sourceId:'bank:settle3'},{date:'2024-11-11',amount:-3780000,sourceId:'bank:settle4'}],checks:[{date:'2024-11-05',balance:0},{date:'2024-11-10',balance:470000},{date:'2024-11-11',balance:50000}],evidence:'Provider claim and reports independently checked against the account statements.',reportingEvidence:'Income and reversals use the same category and reports require signed aggregation.'};
const widgets=[{id:'income-widget',type:'summary-card',meta:{name:'Income',conditionsOp:'and',conditions:[{field:'amount',op:'gt',value:0},{field:'transfer',op:'is',value:false}]}},{id:'expense-widget',type:'summary-card',meta:{name:'Expenses',conditionsOp:'and',conditions:[{field:'amount',op:'lt',value:0},{field:'transfer',op:'is',value:false}]}},{id:'spending-widget',type:'spending-card',meta:{conditionsOp:'and',conditions:[]}},{id:'net-widget',type:'net-worth-card',meta:null}];
const clone=x=>structuredClone(x);

test('previews a balanced evidence-backed canceled sale without writes',()=>{
 const p=classifyHeldRefund(candidate,snapshot,ledger,widgets);
 assert.equal(p.action,'reconstruct');assert.deepEqual(p.checks,candidate.checks);assert.equal(p.holdingFinal,0);assert.equal(p.walletFinalDelta,0);
});

test('rejects incomplete settlement, changed fee, duplicate and wrong daily balance',()=>{
 const c=clone(candidate);c.settlements.pop();assert.throws(()=>classifyHeldRefund(c,snapshot,ledger,widgets));
 const x=clone(snapshot);x.transactions.find(t=>t.id==='fee1').amount--;assert.throws(()=>classifyHeldRefund(candidate,x,ledger,widgets));
 const y=clone(snapshot);y.transactions.push({...fees[0],id:'dup',imported_id:'bank:sale'});assert.throws(()=>classifyHeldRefund(candidate,y,ledger,widgets));
 const z=clone(candidate);z.checks[1].balance++;assert.throws(()=>classifyHeldRefund(z,snapshot,ledger,widgets));
});

test('rejects source reuse, pending audit and incomplete supporting sources',()=>{
 const c=clone(candidate);c.settlements[0].sourceId=c.sale.sourceId;assert.throws(()=>classifyHeldRefund(c,snapshot,ledger,widgets));
 const l=clone(ledger);l.marketplaceHeldRefunds={claim12345:{status:'pending'}};assert.throws(()=>classifyHeldRefund(candidate,snapshot,l,widgets));
 const z=clone(candidate);z.statementIds.pop();assert.throws(()=>classifyHeldRefund(z,snapshot,ledger,widgets));
});

test('accepts verified existing charges backed by different reviewed evidence files',()=>{
 const c=clone(candidate),l=clone(ledger); c.fees[1].record.driveFileIds=['statement02'];l.cashflows['bank:mediation']=c.fees[1].record;
 assert.equal(classifyHeldRefund(c,snapshot,l,widgets).action,'reconstruct');
});

function harness({failAt=0,mutateAfterBackup=false,mutateWidgetAfterBackup=false}={}){
 let live=clone(snapshot),l=clone(ledger),dashboard=clone(widgets),writes=0,backups=0,connects=0;
 const api={async sync(){},async shutdown(){},async getPayees(){return clone(live.payees)},
  async createCategory(a){if(++writes===failAt)throw Error('interrupted');live.categories.push({id:'cancelled-category',name:a.name,group_id:a.group_id,is_income:true,hidden:false});return 'cancelled-category'},
  async createAccount(a){if(++writes===failAt)throw Error('interrupted');live.accounts.push({id:'held',name:a.name,offbudget:false,closed:false});live.payees.push({id:'toHeld',name:a.name,transfer_acct:'held'});live.balances.held=0;return 'held'},
  async addTransactions(account,rows,options){if(++writes===failAt)throw Error('interrupted');for(const row of rows){const id='new'+writes,t={...clone(row),id,account,is_parent:false,is_child:false,parent_id:null,subtransactions:[],transfer_id:null,reconciled:false,schedule:null,tombstone:false};if(options.runTransfers){const destination=live.payees.find(p=>p.id===row.payee).transfer_acct;const leg={...clone(t),id:'leg'+writes,account:destination,amount:-row.amount,payee:'toWallet',imported_id:null,transfer_id:id};t.transfer_id=leg.id;live.transactions.push(leg);live.balances[destination]+=leg.amount;}live.transactions.push(t);live.balances[account]+=t.amount;}},
  async closeAccount(id){if(++writes===failAt)throw Error('interrupted');assert.equal(live.balances[id],0);live.accounts.find(a=>a.id===id).closed=true;}
 };
 const d={async connect(){connects++;return {api}},async readDashboard(){return clone(dashboard)},async updateWidget(rt,w){if(++writes===failAt)throw Error('interrupted');dashboard[dashboard.findIndex(x=>x.id===w.id)]=clone(w)},async snapshot(){return clone(live)},async backup(){backups++;if(mutateAfterBackup)live.balances.wallet++;if(mutateWidgetAfterBackup)dashboard[0].meta.name='changed';return '/backup'},async json(){},async requireRun(){return l},async readState(){return l},async save(x){l=x}};
 return {d,get live(){return live},get ledger(){return l},get writes(){return writes},get backups(){return backups},get connects(){return connects},get widgets(){return dashboard}};
}

test('applies complete reconstruction and verifies idempotent retry',async()=>{
 const h=harness(),preview=await reconstructHeldRefund(candidate,false,h.d);assert.match(preview.planHash,/^[a-f0-9]{64}$/);h.d.expectedPlan=preview.planHash;
 const result=await reconstructHeldRefund(candidate,true,h.d);assert.equal(result.verified,true);assert.equal(h.ledger.marketplaceHeldRefunds[candidate.reference].status,'complete');assert.equal(h.live.accounts.find(x=>x.id==='held').closed,true);assert.equal(h.live.balances.held,0);assert.equal(h.live.balances.wallet,snapshot.balances.wallet);assert.equal(h.backups,1);assert.equal(h.live.categories.find(x=>x.id==='cancelled-category').name,candidate.incomeCategoryName);for(const id of ['income-widget','spending-widget'])assert(h.widgets.find(x=>x.id===id).meta.conditions.some(c=>c.field==='category'&&c.op==='isNot'&&c.value==='cancelled-category'));assert.equal(h.widgets.find(x=>x.id==='net-widget').meta,null);
 const writes=h.writes;const retry=await reconstructHeldRefund(candidate,true,h.d);assert.equal(retry.action,'existing');assert.equal(h.writes,writes);
});

test('requires matching preview and does not retry a partial write',async()=>{
 const h=harness({failAt:2}),p=await reconstructHeldRefund(candidate,false,h.d);await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/preview/i);h.d.expectedPlan=p.planHash;await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/interrupted/i);assert.equal(h.ledger.marketplaceHeldRefunds[candidate.reference].status,'pending');const writes=h.writes;await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/pending/i);assert.equal(h.writes,writes);
});

test('revalidates the budget after backup before writing',async()=>{
 const h=harness({mutateAfterBackup:true});h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/changed/i);assert.equal(h.writes,0);
});

test('all pending and completed reconstruction sources remain reserved against other operations',async()=>{
 const {heldRefundSourceConflict}=await import('./actual-marketplace-held-refund.mjs');
 for(const status of ['pending','complete']){
  const l={marketplaceHeldRefunds:{claim12345:{status,candidate}}};
  assert.equal(heldRefundSourceConflict({sourceId:candidate.sale.sourceId},l),true);
  assert.equal(heldRefundSourceConflict({sourceIds:[candidate.hold.releaseSourceId]},l),true);
  assert.equal(heldRefundSourceConflict({sourceId:'bank:unrelated'},l),false);
 }
});

test('rejects a new source nested in another verified record',()=>{
 const l=clone(ledger);l.records={elsewhere:{status:'registered',sourceIds:[candidate.sale.sourceId]}};
 assert.throws(()=>classifyHeldRefund(candidate,snapshot,l,widgets),/source conflict/i);
});

test('rejects an unresolved reconstruction on the same wallet even with unrelated sources',()=>{
 const l=clone(ledger);l.marketplaceHeldRefunds={anotherClaim:{status:'pending',candidate:{...clone(candidate),reference:'otherClaim'}}};
 assert.throws(()=>classifyHeldRefund(candidate,snapshot,l,widgets),/pending/i);
});

test('reconstruction retry refuses tampering with an already posted component',async()=>{
 const h=harness();h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;await reconstructHeldRefund(candidate,true,h.d);
 h.live.transactions.find(t=>t.imported_id===candidate.sale.sourceId).amount++;
 const before=h.writes;await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/differs/i);assert.equal(h.writes,before);
});

test('rejects OR dashboard composition and a preexisting category',()=>{
 const ws=clone(widgets);ws[0].meta.conditionsOp='or';assert.throws(()=>classifyHeldRefund(candidate,snapshot,ledger,ws),/filter composition/i);
 const s=clone(snapshot);s.categories.push({id:'old',name:candidate.incomeCategoryName,is_income:true,hidden:false,group_id:candidate.incomeGroup});assert.throws(()=>classifyHeldRefund(candidate,s,ledger,widgets),/already exists/i);
});

test('dashboard changes after backup fail before creating any data',async()=>{
 const h=harness({mutateWidgetAfterBackup:true});h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;
 await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/dashboard changed/i);assert.equal(h.writes,0);
});

test('interrupted dashboard update keeps pending intent and cannot be retried',async()=>{
 const h=harness({failAt:2});h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;
 await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/interrupted/i);assert.equal(h.ledger.marketplaceHeldRefunds[candidate.reference].stage,'before-widgets');const n=h.writes;
 await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/pending/i);assert.equal(h.writes,n);
});

test('completed retry detects a removed dashboard exclusion',async()=>{
 const h=harness();h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;await reconstructHeldRefund(candidate,true,h.d);
 h.widgets[0].meta.conditions=[];const n=h.writes;await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/dashboard changed/i);assert.equal(h.writes,n);
});

test('plan hash prevents applying a changed dashboard',async()=>{
 const h=harness();h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;
 h.widgets[0].meta.name='changed after preview';await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/preview/i);assert.equal(h.writes,0);assert.equal(h.backups,0);
});

test('detects mutated transfer leg and settlement cleared flag on retry',async()=>{
 const h=harness();h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;await reconstructHeldRefund(candidate,true,h.d);
 for(const [row,field,value] of [[h.live.transactions.find(x=>x.imported_id===candidate.sale.sourceId),'cleared',true],[h.live.transactions.find(x=>x.account==='held'),'imported_id','bank:forged']]){
  const old=row[field];row[field]=value;await assert.rejects(reconstructHeldRefund(candidate,true,h.d));row[field]=old;
 }
});

test('does not close the temporary account after a corrupt independent readback',async()=>{
 const h=harness(),original=h.d.snapshot;let corrupted=false;
 h.d.snapshot=async()=>{if(!corrupted&&h.ledger.marketplaceHeldRefunds?.[candidate.reference]?.stage==='before-posting'){h.live.transactions.find(x=>x.imported_id===candidate.sale.sourceId).amount++;corrupted=true;}return original()};
 h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;await assert.rejects(reconstructHeldRefund(candidate,true,h.d),/differs/i);
 assert.equal(h.ledger.marketplaceHeldRefunds[candidate.reference].status,'pending');assert.equal(h.live.accounts.find(a=>a.id==='held').closed,false);
});

test('a pending partial reconstruction blocks unrelated writes to the same wallet',async()=>{
 const {heldRefundSourceConflict}=await import('./actual-marketplace-held-refund.mjs');
 const pending={marketplaceHeldRefunds:{claim12345:{status:'pending',candidate}}};
 assert.equal(heldRefundSourceConflict({account:'wallet',sourceId:'bank:other'},pending),true);
 assert.equal(heldRefundSourceConflict({oldTransaction:{account:'wallet'}},pending),true);
 assert.equal(heldRefundSourceConflict({account:'other',sourceId:'bank:other'},pending),false);
});

test('sign-based dashboard totals exclude canceled settlement entries',async()=>{
 const h=harness();const sum=(state,widget)=>state.transactions.filter(t=>widget.meta.conditions.every(c=>c.field==='amount'?(c.op==='gt'?t.amount>c.value:t.amount<c.value):c.field==='transfer'?Boolean(t.transfer_id)===c.value:c.field==='category'?t.category!==c.value:true)).reduce((n,t)=>n+t.amount,0);
 const before=['income-widget','expense-widget'].map(id=>sum(h.live,h.widgets.find(w=>w.id===id)));
 h.d.expectedPlan=(await reconstructHeldRefund(candidate,false,h.d)).planHash;await reconstructHeldRefund(candidate,true,h.d);
 const after=['income-widget','expense-widget'].map(id=>sum(h.live,h.widgets.find(w=>w.id===id)));assert.deepEqual(after,before);
});

test('refuses future sale settlements and unsafe aggregate amounts',()=>{
 const future=clone(candidate);future.sale.date='2099-01-01';future.hold.date='2099-01-02';future.hold.releaseDate='2099-01-03';for(const x of future.settlements)x.date='2099-01-03';assert.throws(()=>classifyHeldRefund(future,snapshot,ledger,widgets),/future/i);
 const overflow=clone(candidate);overflow.sale.amount=Number.MAX_SAFE_INTEGER;overflow.settlements[0].amount=Number.MAX_SAFE_INTEGER;assert.throws(()=>classifyHeldRefund(overflow,snapshot,ledger,widgets),/unsafe|zero/i);
});
