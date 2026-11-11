import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const allowed=new Set(['transactionResolvedNotesAmendment','currency','transactionId','account','payeeId','date','amount','category','sourceId','sourceIds','oldNotes','oldText','newText','evidence','expectedChildren']);
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
const same=(a,b,msg)=>assert.deepEqual(canon(a),canon(b),msg);
const sameIds=(a,b)=>same([...a].sort(),[...b].sort(),'Ledger source mismatch');
export function classifyResolvedNotes(p,s,ledger){
 assert.equal(p.transactionResolvedNotesAmendment,true,'Resolved note operation required');
 for(const k of Object.keys(p))assert(allowed.has(k),`Unexpected field ${k}`);
 assert(Object.hasOwn(BUDGETS,p.currency),'Only CLP/USD supported');
 for(const k of ['transactionId','account','payeeId','date','sourceId','oldNotes','oldText','newText','evidence'])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!Number.isNaN(Date.parse(p.date))&&new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)===p.date,'Invalid date');
 assert(Number.isSafeInteger(p.amount)&&p.amount<0,'Expected negative expense amount');
 assert(p.category===null||typeof p.category==='string'&&p.category,'Category must be explicit');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length&&p.sourceIds.includes(p.sourceId)&&new Set(p.sourceIds).size===p.sourceIds.length&&p.sourceIds.every(id=>/^[a-f0-9]+$/.test(id)),'Invalid source IDs');
 assert(Array.isArray(p.expectedChildren),'Expected children required');
 for(const str of [p.oldText,p.newText])assert(!/[\r\n#]|https?:|source\s*=|refundOf\s*=/i.test(str),'Replacement cannot touch links or tags');
 assert.notEqual(p.oldText,p.newText);assert.equal(p.oldNotes.split(p.oldText).length,2,'Old text must appear once');
 let start=p.oldNotes.indexOf(p.oldText),end=start+p.oldText.length;
 for(const pat of [/https?:\/\/\S+/gi,/#[\p{L}\p{N}_-]+/gu,/^(?:source|refundOf)=.*$/gm])for(const m of p.oldNotes.matchAll(pat))assert(end<=m.index||start>=m.index+m[0].length,'Replacement overlaps protected data');
 let links=[...p.oldNotes.matchAll(/^https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/([a-f0-9]+)$/gm)].map(m=>m[1]);assert(new Set(links).size===links.length&&links.every(x=>p.sourceIds.includes(x)),'Unexpected source in notes');
 let records=Object.entries(ledger.records??{}).filter(([,v])=>v.transactionId===p.transactionId);sameIds(records.map(([k])=>k),p.sourceIds);
 for(const [id,v] of records){for(const k of ['transactionId','currency','account','date','amount','category'])assert.equal(v[k],p[k],`Ledger mismatch ${k}`);assert.equal(v.status,'registered');assert(v.verifiedAt,'Ledger source was not verified');assert.equal(v.sourceType??'gmail','gmail');sameIds(v.sourceIds,p.sourceIds);}
 let matches=s.transactions.filter(t=>t.id===p.transactionId);assert.equal(matches.length,1,'Target not unique');let t=matches[0];
 assert(!t.is_child&&!t.parent_id&&!t.transfer_id,'Child and transfer forbidden');
 for(const [field,key] of [['account','account'],['payee','payeeId'],['date','date'],['amount','amount'],['category','category']])assert.equal(t[field]??null,p[key],`Identity mismatch ${field}`);
 assert.equal(t.imported_id,'gmail:'+p.sourceId,'Primary source mismatch');
 for(const id of p.sourceIds){let others=s.transactions.filter(z=>z.id!==t.id&&(z.imported_id==='gmail:'+id||z.notes?.split('\n').includes('https://mail.google.com/mail/u/0/#all/'+id)));assert.equal(others.length,0,'Source belongs to another transaction');}
 if(p.expectedChildren.length){assert(t.is_parent&&p.category===null&&p.expectedChildren.length>=2,'Expected split parent');same(t.subtransactions,p.expectedChildren,'Split children mismatch');assert.equal(p.expectedChildren.reduce((n,z)=>n+z.amount,0),p.amount,'Split sum mismatch');for(const z of p.expectedChildren)assert(z.id&&z.category&&s.categories.some(c=>c.id===z.category&&!c.hidden),'Split child category unavailable');}
 else{assert(!t.is_parent&&!t.subtransactions?.length&&p.category,'Expected categorized simple expense');assert(s.categories.some(c=>c.id===p.category&&!c.hidden),'Category unavailable');}
 assert(s.accounts.some(a=>a.id===p.account&&!a.closed&&!a.offbudget),'Account unavailable');assert(s.payees.some(a=>a.id===p.payeeId&&!a.transfer_acct),'Payee unavailable');
 let newNotes=p.oldNotes.slice(0,start)+p.newText+p.oldNotes.slice(end);assert(t.notes===p.oldNotes||t.notes===newNotes,'Notes changed since preview');
 return {action:t.notes===newNotes?'existing':'amend-resolved-notes',id:t.id,oldNotes:p.oldNotes,newNotes};
}
export async function amendResolvedNotes(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Only CLP/USD supported');let ledger=commit?await d.requireRun():await d.readState(),{api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir=null;
 try{before=await d.snapshot(api);action=classifyResolvedNotes(p,before,ledger);if(!commit)return {...action,candidate:p};if(action.action!=='existing'){dir=await d.backup(api,p.currency,before);await d.json(dir+'/resolved-notes-amendment.json',{candidate:p,newNotes:action.newNotes});await api.sync();same(await d.snapshot(api),before,'Budget changed before amendment');classifyResolvedNotes(p,before,await d.requireRun());await api.updateTransaction(p.transactionId,{notes:action.newNotes});await api.sync();}}finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{let after=await d.snapshot(api),lease=await d.requireRun();assert.equal(classifyResolvedNotes(p,after,lease).action,'existing','Readback mismatch');let expected={...before,transactions:before.transactions.map(t=>t.id===p.transactionId?{...t,notes:action.newNotes}:t)};same(after,expected,'Unrelated data changed');if(dir)await d.json(dir+'/after.json',after);let audit={oldNotes:p.oldNotes,newNotes:action.newNotes,evidence:p.evidence,verifiedAt:new Date().toISOString(),backup:dir,recovered:!dir,operation:'resolved-notes'};for(const id of p.sourceIds){let r=lease.records[id],h=r.notesAmendments??[];if(!h.some(a=>a.oldNotes===audit.oldNotes&&a.newNotes===audit.newNotes))r.notesAmendments=[...h,audit];}await d.save(lease);return {...action,verified:true,backup:dir};}finally{await api.shutdown();}
}
