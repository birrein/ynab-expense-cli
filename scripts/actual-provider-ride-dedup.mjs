import assert from 'node:assert/strict';import {readFile,lstat} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {isAbsolute} from 'node:path';import {BUDGETS} from './actual-daily-policy.mjs';
const archiveCheck=String.raw`
import sys,json,io,zipfile,csv,base64,datetime,decimal
x=json.load(sys.stdin)
z=zipfile.ZipFile(io.BytesIO(base64.b64decode(x['archive'],validate=True)))
name='Uber Data/Rider/rider_lifetime_trips-0.csv'
assert z.namelist().count(name)==1, 'Trip file missing or duplicated'
info=z.getinfo(name)
assert info.file_size<=20000000, 'Trip file too large'
f=io.TextIOWrapper(z.open(info),encoding='utf-8-sig',newline='')
r=csv.DictReader(f)
fields=['request_timestamp_local','status','is_completed','client_upfront_fare_local','currency_code','payment_type','card_number']
assert r.fieldnames and all(k in r.fieldnames for k in fields), 'Missing columns'
rows=list(r)
assert rows and len(rows)<=100000, 'Invalid row count'
times=[]
for v in rows:
 assert v['request_timestamp_local'], 'Trip missing request time'
 times.append(datetime.datetime.strptime(v['request_timestamp_local'],'%Y-%m-%d %H:%M:%S'))
day=datetime.date.fromisoformat(x['disputedDate'])
assert min(times).date()<=day-datetime.timedelta(days=1) and max(times).date()>=day+datetime.timedelta(days=1), 'Archive does not cover disputed interval'
near=[v for v,t in zip(rows,times) if abs((t.date()-day).days)<=1]
assert len(near)==0, 'Trip exists near disputed date'
q=x['retained']
def match(v):
 try: fare=decimal.Decimal(v['client_upfront_fare_local'])*100
 except decimal.InvalidOperation:return False
 return v['request_timestamp_local']==q['timestamp'] and v['status'].lower()=='completed' and v['is_completed'].lower()=='true' and v['currency_code']==q['currency'] and v['payment_type']=='BANK_CARD' and v['card_number']==q['cardLast4'] and fare==-q['amount']
matches=[v for v in rows if match(v)]
assert len(matches)==1, 'Retained trip missing or ambiguous'
print(json.dumps({'verified':True,'retainedMatches':1,'disputedTrips':0}))
`;
export async function verifyProviderArchive(path,sha,retained,disputedDate){
 assert(typeof path==='string'&&isAbsolute(path),'Absolute private archive path required');assert(/^[a-f0-9]{64}$/.test(sha),'Invalid archive digest');assert(retained&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(retained.timestamp)&&Number.isSafeInteger(retained.amount)&&retained.amount<0&&retained.currency==='CLP'&&/^\d{4}$/.test(retained.cardLast4),'Invalid retained trip');assert(/^\d{4}-\d\d-\d\d$/.test(disputedDate),'Invalid disputed date');const st=await lstat(path);assert(st.isFile()&&st.size>0&&st.size<=25000000,'Invalid archive file');const data=await readFile(path);assert.equal(createHash('sha256').update(data).digest('hex'),sha,'Archive digest mismatch');
 const result=execFileSync('/usr/bin/python3',['-c',archiveCheck],{input:JSON.stringify({archive:data.toString('base64'),retained,disputedDate}),encoding:'utf8',maxBuffer:1000000,stdio:['pipe','pipe','pipe']});return JSON.parse(result);
}
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const equal=(a,b,msg)=>assert.deepEqual(canon(a),canon(b),msg);
const hash=v=>createHash('sha256').update(JSON.stringify(canon(v))).digest('hex');
const validDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export async function classifyProviderRideDuplicate(p,s,ledger){
 equal(Object.keys(p).sort(),['providerRideDedup','currency','old','retained','providerArchive','providerSha256','trip','statementIds','receiptMessageId','routeToken','evidence'].sort(),'Unexpected candidate fields');assert.equal(p.providerRideDedup,true);assert.equal(p.currency,'CLP');assert(Object.hasOwn(BUDGETS,p.currency));
 const {old,retained:r}=p;assert(old&&r&&old.id!==r.id&&old.account===r.account&&old.amount===r.amount&&Number.isSafeInteger(old.amount)&&old.amount<0&&old.amount%100===0,'Transactions differ');assert(old.category&&old.category===r.category&&old.payee&&old.payee===r.payee,'Category or payee differs');
 assert(validDate(old.date)&&validDate(r.date)&&r.date<old.date&&Date.parse(old.date)-Date.parse(r.date)<=31*86400000,'Invalid dates');assert(p.trip?.timestamp?.slice(0,10)===r.date&&p.trip.amount===r.amount&&p.trip.currency===p.currency,'Trip does not match retained row');
 assert(Array.isArray(p.statementIds)&&p.statementIds.length===2&&new Set(p.statementIds).size===2&&p.statementIds.every(x=>/^[A-Za-z0-9_-]{8,}$/.test(x)),'Two distinct statements required');assert(/^[a-f0-9]{8,}$/.test(p.receiptMessageId));assert(typeof p.evidence==='string'&&p.evidence.trim().length>=20,'Detailed evidence required');assert(typeof p.routeToken==='string'&&p.routeToken.trim().length>=3,'Route evidence required');for(const t of [old,r]){assert((t.notes??'').toLocaleLowerCase().includes(p.routeToken.toLocaleLowerCase()),'Shared route absent');assert(!t.imported_id&&!t.reconciled&&!t.transfer_id&&!t.is_parent&&!t.is_child&&!t.parent_id&&!t.schedule&&!t.starting_balance_flag&&!t.subtransactions?.length,'Unsupported row');const found=s.transactions.filter(x=>x.id===t.id);assert.equal(found.length,1,'Row missing');equal(found[0],t,'Row changed');}assert.equal(old.cleared,false,'Disputed record must be uncleared');assert.equal(r.cleared,true,'Retained record must be cleared');assert(s.accounts.some(a=>a.id===old.account&&!a.closed&&!a.offbudget),'Account unavailable');
 for(const t of s.transactions){if([old.id,r.id].includes(t.id))continue;if(t.account===old.account&&t.amount===old.amount&&t.payee===old.payee&&[old.date,r.date].some(d=>Math.abs(Date.parse(t.date)-Date.parse(d))<=3*86400000))assert.fail('Additional matching ride requires review');}
 for(const [key,value] of Object.entries(ledger)){if(key==='activeRun')continue;let str=JSON.stringify(value);for(const id of [old.id,r.id])assert(!str?.includes(id),'Unexpected ledger ownership or reference');}
 await verifyProviderArchive(p.providerArchive,p.providerSha256,p.trip,old.date);let stable=structuredClone(ledger);delete stable.activeRun;return {action:'retire',oldId:old.id,retainedId:r.id,balanceDelta:-old.amount,planHash:hash({candidate:p,snapshot:s,ledger:stable})};
}
export async function retireProviderRideDuplicate(p,commit,d){
 assert(Object.hasOwn(BUDGETS,p.currency),'Unsupported currency');if(commit)assert(/^[a-f0-9]{64}$/.test(d.expectedPlan??''),'Exact plan digest required');
 let ledger=commit?await d.requireRun():await d.readState();assert(!Object.values(ledger.providerRideDedups??{}).some(x=>x?.status==='pending'),'Pending provider ride retirement requires investigation');
 const existing=commit?ledger.providerRideDedups?.[d.expectedPlan]:null;
 if(existing){assert(existing.status==='complete'&&existing.planHash===d.expectedPlan&&existing.backup&&existing.verifiedAt,'Incomplete audit');equal(existing.candidate,p,'Candidate changed');await verifyProviderArchive(p.providerArchive,p.providerSha256,p.trip,p.old.date);const {api}=await d.connect(BUDGETS[p.currency].syncId);try{const now=await d.snapshot(api);assert(!now.transactions.some(t=>t.id===p.old.id),'Old ride reappeared');const kept=now.transactions.filter(t=>t.id===p.retained.id);assert.equal(kept.length,1);equal(kept[0],p.retained,'Retained ride changed');return {action:'existing',verified:true,backup:existing.backup,planHash:d.expectedPlan}}finally{await api.shutdown()}}
 let {api}=await d.connect(BUDGETS[p.currency].syncId),before,plan,dir;
 try{
  before=await d.snapshot(api);before.dashboards=await d.readDashboard(api);plan=await classifyProviderRideDuplicate(p,before,ledger);if(!commit)return {...plan,candidate:p};assert.equal(plan.planHash,d.expectedPlan,'Plan digest changed');
  dir=await d.backup(api,p.currency,before);await d.json(dir+'/provider-ride-dedup.json',{candidate:p,plan});await api.sync();const latest=await d.snapshot(api);latest.dashboards=await d.readDashboard(api);equal(latest,before,'Budget changed before retirement');ledger=await d.requireRun();assert(!Object.values(ledger.providerRideDedups??{}).some(x=>x?.status==='pending'),'Pending provider ride retirement');assert.equal((await classifyProviderRideDuplicate(p,latest,ledger)).planHash,d.expectedPlan,'Plan digest changed');
  ledger.providerRideDedups??={};assert(!ledger.providerRideDedups[d.expectedPlan],'Existing audit');ledger.providerRideDedups[d.expectedPlan]={status:'pending',candidate:p,planHash:d.expectedPlan,backup:dir};await d.save(ledger);await api.deleteTransaction(p.old.id);await api.sync();
 }finally{await api.shutdown();}
 ({api}=await d.connect(BUDGETS[p.currency].syncId));try{
  const after=await d.snapshot(api);after.dashboards=await d.readDashboard(api);const expected=structuredClone(before);expected.transactions=expected.transactions.filter(t=>t.id!==p.old.id);expected.balances[p.old.account]-=p.old.amount;const {transactions:actual,...ar}=after,{transactions:wanted,...wr}=expected;equal(ar,wr,'Unrelated budget state changed');assert.equal(actual.length,wanted.length);const map=new Map(actual.map(t=>[t.id,t]));assert.equal(map.size,actual.length);for(const t of wanted)equal(map.get(t.id),t,'Unrelated transaction changed');await d.json(dir+'/after.json',after);ledger=await d.requireRun();const audit=ledger.providerRideDedups?.[d.expectedPlan];assert.equal(audit?.status,'pending');equal(audit.candidate,p,'Pending candidate changed');ledger.providerRideDedups[d.expectedPlan]={...audit,status:'complete',verifiedAt:new Date().toISOString()};await d.save(ledger);return {...plan,verified:true,backup:dir};
 }finally{await api.shutdown()}
}
