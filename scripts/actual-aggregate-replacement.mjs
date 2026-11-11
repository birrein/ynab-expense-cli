import assert from 'node:assert/strict';
import {BUDGETS} from './actual-daily-policy.mjs';

const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const eq=(a,b,m)=>assert.deepEqual(canon(a),canon(b),m);
const keys=new Set(['historicalAggregateTransferReplacement','currency','oldOrigin','oldDestination','statementDate','statementFileId','evidence','components']);
const validDate=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const note=(p,x)=>`Transferencia propia; componente individual respaldado.\nhttps://mail.google.com/mail/u/0/#all/${x.receiptId}\nhttps://drive.google.com/file/d/${p.statementFileId}/view\nsource=${x.sourceId}`;

function pairFor(p,s,x,ids){
 const rows=s.transactions.filter(t=>t.imported_id===x.sourceId);assert.equal(rows.length,1,'Expected one imported source');const a=rows[0],b=s.transactions.find(t=>t.id===a.transfer_id);assert(b,'Missing counterpart');
 assert.equal(a.account,p.oldOrigin.account);assert.equal(a.amount,x.amount);assert.equal(a.date,p.oldOrigin.date);assert.equal(a.payee,p.oldOrigin.payee);assert.equal(a.category??null,null);assert.equal(a.notes,note(p,x));
 assert.equal(b.account,p.oldDestination.account);assert.equal(b.amount,-x.amount);assert.equal(b.date,a.date);assert.equal(b.payee,p.oldDestination.payee);assert.equal(b.transfer_id,a.id);assert.equal(b.category??null,null);assert.equal(b.imported_id??null,null);assert.equal(b.notes,a.notes);
 assert(!a.is_parent&&!a.is_child&&!b.is_parent&&!b.is_child&&!a.reconciled&&!b.reconciled);if(ids)eq([a.id,b.id],ids,'Pair identifiers changed');return [a.id,b.id];
}

export function classifyAggregateReplacement(p,s,ledger){
 assert.equal(p.historicalAggregateTransferReplacement,true);for(const k of Object.keys(p))assert(keys.has(k),'Unknown field '+k);assert(Object.hasOwn(BUDGETS,p.currency));
 const o=p.oldOrigin,d=p.oldDestination;assert(o&&d&&o.id&&d.id&&o.id!==d.id&&o.account!==d.account);assert(validDate(o.date)&&validDate(p.statementDate));assert(Math.abs(Date.parse(o.date)-Date.parse(p.statementDate))<=86400000,'Statement date mismatch');
 assert.equal(d.date,o.date);assert(Number.isSafeInteger(o.amount)&&o.amount<0&&d.amount===-o.amount);assert.equal(o.transfer_id,d.id);assert.equal(d.transfer_id,o.id);
 for(const t of [o,d])assert(!t.category&&!t.notes&&!t.imported_id&&!t.cleared&&!t.reconciled&&!t.starting_balance_flag&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.subtransactions?.length&&!t.schedule&&!t.tombstone,'Invalid legacy leg');
 for(const id of [o.account,d.account])assert(s.accounts.some(a=>a.id===id&&!a.closed&&!a.offbudget),'Account unavailable');
 for(const [t,target] of [[o,d.account],[d,o.account]]){const pays=s.payees.filter(x=>x.transfer_acct===target);assert.equal(pays.length,1);assert.equal(t.payee,pays[0].id)}
 assert(typeof p.statementFileId==='string'&&/^[A-Za-z0-9_-]{8,}$/.test(p.statementFileId));assert(typeof p.evidence==='string'&&p.evidence.trim());assert(Array.isArray(p.components)&&p.components.length>=2);
 const seenSources=new Set(),seenReceipts=new Set();let total=0;for(const x of p.components){eq(Object.keys(x).sort(),['amount','receiptId','sourceId']);assert(Number.isSafeInteger(x.amount)&&x.amount<0);assert(typeof x.sourceId==='string'&&/^bank:[a-z0-9:_-]+$/.test(x.sourceId));assert(typeof x.receiptId==='string'&&/^[a-f0-9]{16}$/.test(x.receiptId));assert(!seenSources.has(x.sourceId)&&!seenReceipts.has(x.receiptId),'Duplicate source');seenSources.add(x.sourceId);seenReceipts.add(x.receiptId);total+=x.amount;assert(Number.isSafeInteger(total))}assert.equal(total,o.amount,'Components must sum to aggregate');
 const audit=ledger.aggregateTransferReplacements?.[o.id];if(audit){assert.equal(audit.status,'complete','Pending replacement requires investigation');eq(audit.candidate,p,'Audit candidate mismatch');assert(!s.transactions.some(t=>[o.id,d.id].includes(t.id)));assert.equal(audit.pairs.length,p.components.length);p.components.forEach((x,i)=>{const ids=pairFor(p,s,x,audit.pairs[i]);const record=ledger.cashflows?.[x.sourceId];assert(record&&record.status==='registered'&&record.type==='transfer'&&record.id===ids[0]&&record.counterpartId===ids[1]&&record.account===o.account&&record.destination===d.account&&record.amount===x.amount&&record.date===o.date&&record.currency===p.currency&&record.verifiedAt,'Completed ledger mismatch');eq(record.sourceIds,[x.receiptId]);eq(record.driveFileIds,[p.statementFileId]);const matches=s.transactions.filter(t=>String(t.notes??'').includes('https://mail.google.com/mail/u/0/#all/'+x.receiptId));eq(matches.map(t=>t.id).sort(),ids.slice().sort(),'Receipt linked elsewhere')});return{action:'existing',pairs:audit.pairs};}
 for(const t of [o,d]){const matches=s.transactions.filter(x=>x.id===t.id);assert.equal(matches.length,1);eq(matches[0],t,'Historical snapshot changed')}
 for(const x of Object.values(ledger.records??{}))assert(![o.id,d.id].includes(x.transactionId),'Legacy ledger conflict');
 for(const x of Object.values(ledger.cashflows??{})){assert(![o.id,d.id].includes(x.id)&&![o.id,d.id].includes(x.counterpartId),'Legacy ledger conflict');assert(!(x.sourceIds??[]).some(id=>seenReceipts.has(id)),'Receipt already owned')}
 for(const x of p.components)assert(!ledger.cashflows?.[x.sourceId]&&!ledger.records?.[x.receiptId],'Source already owned');
 for(const t of s.transactions){assert(!seenSources.has(t.imported_id),'Source already imported');for(const id of seenReceipts)assert(!String(t.notes??'').includes('https://mail.google.com/mail/u/0/#all/'+id),'Receipt already linked');if([o.id,d.id].includes(t.id))continue;for(const x of p.components)assert(!(Math.abs(Date.parse(t.date)-Date.parse(o.date))<=4*86400000&&((t.account===o.account&&t.amount===x.amount)||(t.account===d.account&&t.amount===-x.amount))),'Possible duplicate component')}
 return{action:'replace'};
}

export async function replaceAggregateTransfer(p,commit,ctx){
 assert(Object.hasOwn(BUDGETS,p.currency));let ledger=commit?await ctx.requireRun():await ctx.readState();let {api}=await ctx.connect(BUDGETS[p.currency].syncId),before,dir,action;
 try{before=await ctx.snapshot(api);action=classifyAggregateReplacement(p,before,ledger);if(!commit)return{...action,candidate:p};if(action.action==='existing')return{...action,verified:true,backup:ledger.aggregateTransferReplacements[p.oldOrigin.id].backup};
 dir=await ctx.backup(api,p.currency,before);await ctx.json(dir+'/aggregate-replacement.json',{candidate:p});await api.sync();eq(await ctx.snapshot(api),before,'Budget changed before replacement');ledger=await ctx.requireRun();classifyAggregateReplacement(p,before,ledger);ledger.aggregateTransferReplacements??={};ledger.aggregateTransferReplacements[p.oldOrigin.id]={status:'pending',candidate:p,backup:dir};await ctx.save(ledger);
 await api.deleteTransaction(p.oldOrigin.id);await api.deleteTransaction(p.oldDestination.id);
 for(const x of p.components){await api.addTransactions(p.oldOrigin.account,[{date:p.oldOrigin.date,amount:x.amount,payee:p.oldOrigin.payee,category:null,imported_id:x.sourceId,notes:note(p,x),cleared:false}],{runTransfers:true,learnCategories:false});const found=(await api.getTransactions(p.oldOrigin.account,p.oldOrigin.date,p.oldOrigin.date)).filter(t=>t.imported_id===x.sourceId);assert.equal(found.length,1,'Expected one source after write')}
 await api.sync();}finally{await api.shutdown()}
 ({api}=await ctx.connect(BUDGETS[p.currency].syncId));try{const after=await ctx.snapshot(api);assert(!after.transactions.some(t=>[p.oldOrigin.id,p.oldDestination.id].includes(t.id)),'Old legs remain');const pairs=p.components.map(x=>pairFor(p,after,x));const ids=pairs.flat();assert.equal(new Set(ids).size,ids.length,'Repeated pair');
 const {transactions:at,...ar}=after,{transactions:bt,...br}=before;eq(ar,br,'Unrelated state or balances changed');assert.equal(at.length,bt.length-2+ids.length,'Unexpected transaction count');const map=new Map(at.map(t=>[t.id,t]));assert.equal(map.size,at.length);for(const t of bt)if(![p.oldOrigin.id,p.oldDestination.id].includes(t.id))eq(map.get(t.id),t,'Other transaction changed');
 await ctx.json(dir+'/after.json',after);ledger=await ctx.requireRun();const audit=ledger.aggregateTransferReplacements?.[p.oldOrigin.id];assert.equal(audit?.status,'pending');eq(audit.candidate,p);ledger.cashflows??={};p.components.forEach((x,i)=>{assert(!ledger.cashflows[x.sourceId]);ledger.cashflows[x.sourceId]={type:'transfer',id:pairs[i][0],counterpartId:pairs[i][1],currency:p.currency,account:p.oldOrigin.account,destination:p.oldDestination.account,date:p.oldOrigin.date,amount:x.amount,status:'registered',sourceIds:[x.receiptId],driveFileIds:[p.statementFileId],evidence:p.evidence,backup:dir,verifiedAt:new Date().toISOString()}});ledger.aggregateTransferReplacements[p.oldOrigin.id]={...audit,status:'complete',pairs,verifiedAt:new Date().toISOString()};await ctx.save(ledger);return{...action,pairs,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
