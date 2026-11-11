import assert from 'node:assert/strict';
import { BUDGETS, candidateImportedId } from './actual-daily-policy.mjs';
import { noteTagTokens, prefixNoteTags } from './actual-note-tags.mjs';

const identityFields=['currency','transactionId','account','payeeId','date','amount','category','sourceType','sourceId','sourceIds','oldNotes','evidence'];
const fields=new Set([...identityFields,'transactionNotesAmendment','oldText','newText']);
const tagFields=new Set([...identityFields,'transactionTagAmendment','tag']);
const prefixFields=new Set([...identityFields,'transactionTagsPrefixAmendment']);
const repairFields=new Set([...identityFields,'transactionNotesLineRepair','priorNotes']);
const sameSources=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort(),'Amendment source IDs differ');
const sourceLine=(p,id)=>p.sourceType==='manual'?`source=${id}`:`https://mail.google.com/mail/u/0/#all/${id}`;
const hasSource=(p,t,id)=>t.imported_id===candidateImportedId(p,id)||t.notes?.split('\n').includes(sourceLine(p,id));

function replacement(p){
 const isTag=Object.hasOwn(p,'transactionTagAmendment');
 const isPrefix=Object.hasOwn(p,'transactionTagsPrefixAmendment');
 const isRepair=Object.hasOwn(p,'transactionNotesLineRepair');
 const flags=['transactionNotesAmendment','transactionTagAmendment','transactionTagsPrefixAmendment','transactionNotesLineRepair'].filter(k=>Object.hasOwn(p,k));
 assert(flags.length===1&&p[flags[0]]===true,'Expected exactly one transaction notes amendment operation');
 for(const k of Object.keys(p))assert((isTag?tagFields:isPrefix?prefixFields:isRepair?repairFields:fields).has(k),`Unexpected notes amendment field ${k}`);
 assert(Object.hasOwn(BUDGETS,p.currency),'Only CLP/USD supported');
 for(const k of ['transactionId','account','payeeId','date','category','sourceId','oldNotes','evidence',...(isTag?['tag']:isPrefix?[]:isRepair?['priorNotes']:['oldText','newText'])])assert(typeof p[k]==='string'&&p[k].trim(),`Missing ${k}`);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&!Number.isNaN(Date.parse(p.date))&&new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)===p.date,'Invalid amendment date');
 assert(Number.isSafeInteger(p.amount)&&p.amount<0,'Notes amendment requires expense in negative integer cents');
 assert(p.sourceType===undefined||p.sourceType==='gmail'||p.sourceType==='manual','Unsupported source type');
 assert(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&p.sourceIds.includes(p.sourceId)&&new Set(p.sourceIds).size===p.sourceIds.length,'Missing or duplicate source IDs');
 assert(p.sourceIds.every(id=>typeof id==='string'&&(p.sourceType==='manual'?/^manual:[a-z0-9:_-]+$/:/^[a-f0-9]+$/).test(id)),'Invalid source IDs');
 if(p.sourceType==='manual')assert.equal(p.sourceIds.length,1,'Manual source needs one stable ID');
 const original=isRepair?p.priorNotes:p.oldNotes;
 if(isRepair){assert.equal(p.sourceType??'gmail','gmail','Repair requires Gmail evidence');assert.equal(p.sourceIds.length,1,'Repair requires exactly one Gmail source');assert(p.priorNotes.includes('\n')&&!p.priorNotes.includes('\r'),'Repair requires prior multiline notes');assert.equal(p.priorNotes.replaceAll('\n',''),p.oldNotes,'Current notes are not exactly joined prior lines');}
 const sources=p.sourceType==='manual'?[...original.matchAll(/^source=(manual:[a-z0-9:_-]+)$/gm)].map(m=>m[1]):[...original.matchAll(/^https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/([a-f0-9]+)$/gm)].map(m=>m[1]);
 sameSources(sources,p.sourceIds);
 if(isRepair)return prefixNoteTags(p.priorNotes);
 if(isPrefix)return prefixNoteTags(p.oldNotes);
 if(isTag){
  assert(/^#[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(p.tag),'Invalid tag: supply one bounded ASCII hashtag');
  // URL fragments are provenance, not note tags. Recognize complete Unicode tokens
  // so a longer existing tag is never mistaken for the requested ASCII tag.
  const tags=noteTagTokens(p.oldNotes).map(t=>t.tag.toLowerCase());
  const count=tags.filter(tag=>tag===p.tag.toLowerCase()).length;
  assert(count<=1,'Duplicate tag occurrences require review');
  if(count===1)return p.oldNotes;
  return p.tag+'\n'+p.oldNotes;
 }
 for(const text of [p.oldText,p.newText])assert(!/[\r\n#]|https?:|source\s*=|refundOf\s*=/i.test(text),'Replacement cannot touch links, tags or source metadata');
 assert.notEqual(p.oldText,p.newText,'Amendment must change descriptive text');
 assert.equal(p.oldNotes.split(p.oldText).length,2,'Old text must occur exactly once');
 const start=p.oldNotes.indexOf(p.oldText),end=start+p.oldText.length;
 // A short fragment must not edit inside a URL, hashtag or metadata value either.
 for(const pattern of [/https?:\/\/\S+/gi,/#[\p{L}\p{N}_-]+/gu,/^(?:source|refundOf)=.*$/gm]){
  for(const m of p.oldNotes.matchAll(pattern))assert(end<=m.index||start>=m.index+m[0].length,'Replacement overlaps protected metadata');
 }
 // String slicing avoids replacement-string interpretation of $&, $` and $'.
 return p.oldNotes.slice(0,start)+p.newText+p.oldNotes.slice(start+p.oldText.length);
}

function validateLedger(p,s){
 const ids=Object.entries(s.records).filter(([,r])=>r.transactionId===p.transactionId).map(([id])=>id);
 sameSources(ids,p.sourceIds);
 for(const id of p.sourceIds){
  const r=s.records[id];assert(r,'Amendment source missing from authoritative ledger');
  for(const k of ['transactionId','currency','account','date','amount','category'])assert.equal(r[k],p[k],`Amendment ledger mismatch ${k}`);
  assert.equal(r.status,'registered','Notes amendment requires registered transaction');
  assert.equal(r.sourceType??'gmail',p.sourceType??'gmail','Amendment ledger source type mismatch');
  sameSources(r.sourceIds,p.sourceIds);
 }
}

export function classifyTransactionNotesAmendment(p,s,ledger){
 const newNotes=replacement(p),matches=s.transactions.filter(t=>t.id===p.transactionId);
 assert.equal(matches.length,1,'Expected one existing amendment transaction');
 const t=matches[0];
 assert(!t.is_parent&&!t.is_child&&!t.parent_id&&!t.transfer_id&&!t.subtransactions?.length,'Only a simple non-transfer expense can have notes amended');
 for(const [field,key] of [['account','account'],['payee','payeeId'],['date','date'],['amount','amount'],['category','category']])assert.equal(t[field],p[key],`Amendment transaction mismatch ${field}`);
 assert.equal(t.imported_id,candidateImportedId(p),'Amendment primary source mismatch');
 for(const id of p.sourceIds){
  const sourced=s.transactions.filter(item=>hasSource(p,item,id));
  assert.equal(sourced.length,1,'Ambiguous amendment source');assert.equal(sourced[0].id,p.transactionId,'Amendment source belongs to another transaction');
  if(!p.transactionNotesLineRepair||t.notes!==p.oldNotes)assert(t.notes?.split('\n').includes(sourceLine(p,id)),'Amendment source link missing');
 }
 assert(s.accounts.some(a=>a.id===p.account&&!a.closed&&!a.offbudget),'Amendment account missing/closed/offbudget');
 assert(s.categories.some(c=>c.id===p.category&&!c.hidden),'Amendment category missing/hidden');
 assert(s.payees.some(x=>x.id===p.payeeId&&!x.transfer_acct),'Amendment payee missing or transfer');
 validateLedger(p,ledger);
 if(p.transactionNotesLineRepair)for(const id of p.sourceIds){
  const history=ledger.records[id].notesAmendments??[];
  assert(history.some(a=>a.operation==='add-tag'&&a.newNotes===p.priorNotes&&a.verifiedAt&&a.backup&&typeof a.tag==='string'&&noteTagTokens(p.priorNotes).filter(t=>t.tag.toLowerCase()===a.tag.toLowerCase()).length===1),'Repair needs matching previously verified add-tag audit');
 }
 assert(t.notes===p.oldNotes||t.notes===newNotes,'Amendment previous notes mismatch');
 return {action:t.notes===newNotes?'existing':p.transactionTagAmendment?'add-tag':p.transactionTagsPrefixAmendment?'prefix-tags':p.transactionNotesLineRepair?'repair-note-lines':'amend-notes',id:p.transactionId,oldNotes:p.oldNotes,newNotes,label:null,...(p.transactionTagAmendment?{tag:p.tag}:{})};
}

export async function amendTransactionNotes(p,commit,d){
 // Validate before obtaining credentials or connecting, including the budget allowlist.
 replacement(p);
 const ledger=commit?await d.requireRun():await d.readState();
 let {api}=await d.connect(BUDGETS[p.currency].syncId),before,action,dir=null;
 try{
  before=await d.snapshot(api);action=classifyTransactionNotesAmendment(p,before,ledger);
  if(!commit)return {...action,candidate:p};
  if(action.action!=='existing'){
   dir=await d.backup(api,p.currency,before);
   await d.json(dir+'/notes-amendment.json',{candidate:p,newNotes:action.newNotes});
   await api.sync();
   const latest=await d.snapshot(api);
   assert.deepEqual(latest,before,'Budget changed before notes amendment');
   classifyTransactionNotesAmendment(p,latest,await d.requireRun());
   await api.updateTransaction(p.transactionId,{notes:action.newNotes});
   await api.sync();
  }
 }finally{await api.shutdown();}
 // A separate download is required even when recovering a successful prior write.
 ({api}=await d.connect(BUDGETS[p.currency].syncId));
 try{
  const after=await d.snapshot(api),lease=await d.requireRun();
  const checked=classifyTransactionNotesAmendment(p,after,lease);
  assert.equal(checked.action,'existing','Notes missing from independent readback');
  const expected={...before,transactions:before.transactions.map(t=>t.id===p.transactionId?{...t,notes:action.newNotes}:t)};
  assert.deepEqual(after,expected,'Notes amendment changed unrelated budget data');
  if(dir)await d.json(dir+'/after.json',after);
  if(action.oldNotes!==action.newNotes){
   const audit={oldNotes:p.oldNotes,newNotes:action.newNotes,evidence:p.evidence,verifiedAt:new Date().toISOString(),backup:dir,recovered:action.action==='existing',...(p.transactionTagAmendment?{operation:'add-tag',tag:p.tag}:p.transactionTagsPrefixAmendment?{operation:'prefix-tags'}:p.transactionNotesLineRepair?{operation:'repair-note-lines',priorNotes:p.priorNotes}:{})};
   for(const id of p.sourceIds){
    const r=lease.records[id],history=r.notesAmendments??[];
    if(!history.some(a=>a.oldNotes===audit.oldNotes&&a.newNotes===audit.newNotes))r.notesAmendments=[...history,audit];
   }
   await d.save(lease);
  }
  return {...action,verified:true,backup:dir};
 }finally{await api.shutdown();}
}
