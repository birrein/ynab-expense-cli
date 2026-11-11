import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';

const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>isDeepStrictEqual(canonical(a),canonical(b));
const time=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)?Date.parse(x):NaN;

// Only for an exact completed retry. New operations must compare snapshots directly.
export function assertAuditedLineage(original,current,ledger,currency,verifiedAt,message){
 if(same(original,current))return;
 let expected=structuredClone(original),after=time(verifiedAt);
 assert(Number.isFinite(after),message+': invalid original verification time');
 const used=new Set();
 for(let i=0;i<2;i++){
  const candidates=[];
  for(const [key,field,value,kind] of [
   ['historicalExpenseAmountCorrections','amount','newAmount','historicalExpenseAmountCorrection'],
   ['historicalInstallmentDateCorrections','date','newDate','historicalInstallmentDateCorrection'],
  ]){
   const audit=ledger[key]?.[expected.id],p=audit?.candidate,at=time(audit?.verifiedAt);
   if(!audit||used.has(key)||!p||p[kind]!==true||p.currency!==currency||p.oldTransaction?.id!==expected.id||!same(p.oldTransaction,expected)||!Number.isFinite(at)||at<=after||typeof audit.backup!=='string'||!audit.backup.trim())continue;
   if(key==='historicalInstallmentDateCorrections'&&audit.status!=='complete')continue;
   if(key==='historicalExpenseAmountCorrections'&&audit.status!==undefined&&audit.status!=='complete')continue;
   if(field==='amount'&&(!Number.isSafeInteger(p[value])||p[value]>=0||p[value]===expected.amount))continue;
   if(field==='date'&&(typeof p[value]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p[value])||p[value]===expected.date))continue;
   candidates.push({key,field,value:p[value],at});
  }
  assert.equal(candidates.length,1,message+': missing or ambiguous verified link');
  const next=candidates[0];used.add(next.key);expected={...expected,[next.field]:next.value};after=next.at;
  if(same(expected,current))return;
 }
 assert.fail(message+': unverified transaction changes');
}
